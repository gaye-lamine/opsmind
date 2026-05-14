import { loadEnv, getEnv } from "@opsmind/config";
import { createLogger } from "@opsmind/shared";
import { getAgentRuntime, getMonitoringLoop } from "@opsmind/agent";
import { createApp } from "../config/express.config";

const logger = createLogger("Server");

/**
 * OpsMind API Server bootstrap.
 *
 * Startup sequence:
 * 1. Load and validate environment
 * 2. Bootstrap agent runtime (MongoDB + tools)
 * 3. Create Express application
 * 4. Start HTTP server
 * 5. Start autonomous monitoring loop
 */
async function bootstrap(): Promise<void> {
  logger.info("Starting OpsMind API server...");

  // 1. Load environment
  loadEnv();
  const env = getEnv();

  // 2. Bootstrap agent runtime
  const runtime = getAgentRuntime();
  await runtime.bootstrap();

  // 3. Create Express app
  const app = createApp();

  // 4. Start server
  const server = app.listen(env.PORT, () => {
    logger.info("OpsMind API server started", {
      port: env.PORT,
      environment: env.NODE_ENV,
      apiUrl: `http://localhost:${env.PORT}/api`,
    });
  });

  // 5. Start autonomous monitoring loop
  // Checks for anomalies every MONITORING_INTERVAL_MS (default: 5 minutes)
  // Each qualifying anomaly triggers an autonomous investigation session
  const monitoringIntervalMs = env.MONITORING_INTERVAL_MS ?? 5 * 60 * 1000;
  const monitoringLoop = getMonitoringLoop();

  const monitoringTimer = setInterval(async () => {
    try {
      const result = await monitoringLoop.check();
      if (result.investigationsLaunched > 0) {
        logger.info("Autonomous monitoring: investigations launched", {
          anomaliesDetected: result.anomaliesDetected,
          investigationsLaunched: result.investigationsLaunched,
          sessionIds: result.launchedSessionIds,
        });
      }
    } catch (err) {
      logger.error("Monitoring loop error", err instanceof Error ? err : undefined);
    }
  }, monitoringIntervalMs);

  logger.info("Autonomous monitoring loop started", {
    intervalMs: monitoringIntervalMs,
    intervalMinutes: Math.round(monitoringIntervalMs / 60000),
  });

  // ── Graceful Shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — shutting down gracefully...`);

    clearInterval(monitoringTimer);

    server.close(async () => {
      logger.info("HTTP server closed");

      try {
        const { disconnectDatabase } = await import("@opsmind/memory");
        await disconnectDatabase();
        logger.info("MongoDB disconnected");
      } catch (err) {
        logger.error("Error during MongoDB disconnect", err);
      }

      try {
        const { disconnectMongoDbMcpClient } = await import("@opsmind/mcp-client");
        await disconnectMongoDbMcpClient();
        logger.info("MongoDB MCP client disconnected");
      } catch {
        // Non-fatal
      }

      logger.info("Shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason instanceof Error ? reason : undefined, {
      reason: String(reason),
    });
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception — shutting down", err);
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Fatal: failed to start OpsMind API server", err);
  process.exit(1);
});
