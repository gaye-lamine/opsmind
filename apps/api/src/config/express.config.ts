import express, { type Application } from "express";
import cors from "cors";
import { getEnv } from "@opsmind/config";
import { requestLoggerMiddleware } from "../middleware/request-logger.middleware";
import { errorMiddleware } from "../middleware/error.middleware";
import { healthRouter } from "../routes/health/health.routes";
import { agentRouter } from "../routes/agent/agent.routes";
import { decisionRouter } from "../routes/decisions/decision.routes";
import { actionRouter } from "../routes/actions/action.routes";
import { testRouter } from "../routes/test/test.routes";
import { monitoringRouter } from "../routes/monitoring/monitoring.routes";
import { DashboardController } from "../controllers/dashboard.controller";

/**
 * Express application factory.
 *
 * Registers all middleware and routes in the correct order:
 * 1. Security / CORS
 * 2. Body parsing
 * 3. Request logging
 * 4. Routes
 * 5. Error handler (MUST be last)
 */
export function createApp(): Application {
  const app = express();
  const env = getEnv();

  const corsOrigin = env.CORS_ORIGINS === "*"
    ? "*"
    : env.CORS_ORIGINS.split(",").map((o) => o.trim());

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      exposedHeaders: ["x-request-id"],
    })
  );

  // ── Body Parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ── Request Logging ──────────────────────────────────────────────────────────
  app.use(requestLoggerMiddleware);

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.use("/api/health", healthRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/decisions", decisionRouter);
  app.use("/api/actions", actionRouter);
  app.use("/api/monitoring", monitoringRouter);
  app.use("/test", testRouter);

  // Dashboard — single endpoint, inline controller
  const dashboardController = new DashboardController();
  app.get("/api/dashboard", dashboardController.getDashboardState);

  // ── 404 Handler ──────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "[VERSION_2] Route not found" },
    });
  });

  // ── Error Handler (MUST be last) ─────────────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
