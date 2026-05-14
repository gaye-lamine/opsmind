import { createLogger, generateSessionId } from "@opsmind/shared";
import { loadEnv, getEnv } from "@opsmind/config";
import { connectDatabase, ensureIndexes, isDatabaseHealthy } from "@opsmind/memory";
import { initializeTools } from "@opsmind/tools";
import { initializeMongoDbMcpClient } from "@opsmind/mcp-client";
import { Orchestrator } from "../orchestrator/orchestrator";
import { SessionRepository } from "@opsmind/memory";
import { getSseEventStore } from "../sse-event-store";
import {
  type StartSessionInput,
  type SessionStatusOutput,
  type AgentRunResult,
  type PipelineStepEvent,
} from "../../interfaces/agent.interfaces";

const logger = createLogger("AgentRuntime");

/**
 * Agent Runtime — the top-level entry point for the OpsMind agent system.
 *
 * Responsibilities:
 * - Bootstrap: loads config, connects MongoDB, initializes tools
 * - Session management: start, status, list
 * - Delegates execution to the Orchestrator
 * - Health checking
 *
 * apps/api interacts ONLY with AgentRuntime — never with Orchestrator directly.
 * This is the public API of the agent package.
 *
 * Usage:
 *   const runtime = AgentRuntime.getInstance()
 *   await runtime.bootstrap()
 *   const result = await runtime.runSession({ goal: "..." })
 */
export class AgentRuntime {
  private static instance: AgentRuntime | null = null;
  private bootstrapped = false;
  private readonly sessionRepo = new SessionRepository();

  private constructor() {}

  static getInstance(): AgentRuntime {
    if (AgentRuntime.instance === null) {
      AgentRuntime.instance = new AgentRuntime();
    }
    return AgentRuntime.instance;
  }

  /**
   * Bootstraps the agent runtime.
   * Must be called once before any agent sessions can run.
   *
   * Order:
   * 1. Load and validate environment
   * 2. Connect to MongoDB
   * 3. Ensure MongoDB indexes
   * 4. Initialize tool registry
   */
  async bootstrap(): Promise<void> {
    if (this.bootstrapped) {
      logger.debug("Runtime already bootstrapped — skipping");
      return;
    }

    logger.info("Bootstrapping OpsMind agent runtime...");

    // 1. Validate environment
    loadEnv();
    logger.info("Environment validated");

    // 2. Connect MongoDB
    await connectDatabase();
    logger.info("MongoDB connected");

    // 3. Ensure indexes
    await ensureIndexes();
    logger.info("MongoDB indexes ensured");

    // 4. Initialize tools
    initializeTools();
    logger.info("Tool registry initialized");

    // 5. Initialize MongoDB Atlas MCP Client (official MongoDB MCP Server)
    const env = getEnv();
    if (env.ATLAS_MCP_CLIENT_ID !== undefined && env.ATLAS_MCP_CLIENT_SECRET !== undefined) {
      try {
        await initializeMongoDbMcpClient({
          connectionString: env.MONGODB_URI,
          atlasClientId: env.ATLAS_MCP_CLIENT_ID,
          atlasClientSecret: env.ATLAS_MCP_CLIENT_SECRET,
          readOnly: true,
        });
        logger.info("MongoDB Atlas MCP client initialized");
      } catch (err) {
        // Non-fatal — system works without MCP client, just with fewer tools
        logger.warn("MongoDB Atlas MCP client failed to initialize — continuing without it", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      logger.info("MongoDB Atlas MCP credentials not configured — skipping MCP client init");
    }

    this.bootstrapped = true;
    logger.info("Agent runtime bootstrapped successfully");
  }

  /**
   * Starts an agent session and runs the full reasoning pipeline.
   *
   * This is a synchronous execution — it runs the full pipeline and returns
   * the result. For async/background execution, wrap this in a job queue.
   */
  async runSession(
    input: StartSessionInput,
    onEvent?: (event: PipelineStepEvent) => void
  ): Promise<AgentRunResult> {
    this.assertBootstrapped();

    logger.info("Starting agent session", { goal: input.goal.slice(0, 100) });

    const orchestrator = new Orchestrator();
    return orchestrator.run(input.goal, input.context, onEvent);
  }

  /**
   * Starts an agent session asynchronously — returns the sessionId immediately
   * and runs the full pipeline in the background.
   *
   * Pipeline events are stored in SseEventStore and can be consumed via
   * GET /api/agent/sessions/:sessionId/stream (SSE).
   *
   * This is the preferred entry point for API requests — it prevents HTTP
   * timeouts on long-running investigations (30–120s).
   */
  startSessionAsync(input: StartSessionInput): string {
    this.assertBootstrapped();

    const eventStore = getSseEventStore();
    const orchestrator = new Orchestrator();
    const sessionId = generateSessionId();

    // Initialize the SSE buffer for this session
    eventStore.initSession(sessionId);

    logger.info("Starting async agent session", {
      sessionId,
      goal: input.goal.slice(0, 100),
    });

    // Run the pipeline in the background — do NOT await
    orchestrator
      .runWithSessionId(sessionId, input.goal, input.context, (event) => {
        eventStore.push(sessionId, event);
      })
      .catch((err: unknown) => {
        logger.error("Async agent session failed", err instanceof Error ? err : undefined, {
          sessionId,
        });
        eventStore.push(sessionId, {
          type: "session_failed",
          error: err instanceof Error ? err.message : String(err),
          sessionId,
          timestamp: new Date(),
        });
      });

    return sessionId;
  }

  /**
   * Returns the current status of a session.
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusOutput | null> {
    this.assertBootstrapped();

    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return null;

    const totalSteps = session.completedSteps.length + 1; // +1 for current
    const progress = totalSteps > 0
      ? Math.round((session.completedSteps.length / Math.max(totalSteps, 8)) * 100)
      : 0;

    return {
      sessionId: session._id,
      status: session.status,
      currentStep: session.currentStep,
      stepCount: session.stepCount,
      progress: Math.min(progress, 99),
      startedAt: session.startedAt,
      ...(session.completedAt !== undefined ? { completedAt: session.completedAt } : {}),
      ...(session.durationMs !== undefined ? { durationMs: session.durationMs } : {}),
      ...(session.decisionId !== undefined ? { decisionId: session.decisionId } : {}),
      ...(session.error !== undefined
        ? { error: { code: session.error.code, message: session.error.message } }
        : {}),
    };
  }

  /**
   * Returns a list of recent sessions.
   */
  async getRecentSessions(limit = 10): Promise<SessionStatusOutput[]> {
    this.assertBootstrapped();

    const sessions = await this.sessionRepo.findRecentCompleted(limit);
    return sessions.map((session) => ({
      sessionId: session._id,
      status: session.status,
      currentStep: session.currentStep,
      stepCount: session.stepCount,
      progress: session.status === "completed" ? 100 : 0,
      startedAt: session.startedAt,
      ...(session.completedAt !== undefined ? { completedAt: session.completedAt } : {}),
      ...(session.durationMs !== undefined ? { durationMs: session.durationMs } : {}),
      ...(session.decisionId !== undefined ? { decisionId: session.decisionId } : {}),
    }));
  }

  /**
   * Returns active (running) sessions.
   */
  async getActiveSessions(): Promise<SessionStatusOutput[]> {
    this.assertBootstrapped();

    const sessions = await this.sessionRepo.findActive();
    return sessions.map((session) => ({
      sessionId: session._id,
      status: session.status,
      currentStep: session.currentStep,
      stepCount: session.stepCount,
      progress: 0,
      startedAt: session.startedAt,
    }));
  }

  /**
   * Health check — verifies all dependencies are reachable.
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    mongodb: boolean;
    toolRegistry: boolean;
    details: Record<string, unknown>;
  }> {
    const mongoHealthy = await isDatabaseHealthy();

    let toolRegistryHealthy = false;
    let toolCount = 0;
    try {
      const { getToolRegistry } = await import("@opsmind/tools");
      const registry = getToolRegistry();
      toolCount = registry.size;
      toolRegistryHealthy = toolCount > 0;
    } catch {
      toolRegistryHealthy = false;
    }

    const allHealthy = mongoHealthy && toolRegistryHealthy;
    const anyHealthy = mongoHealthy || toolRegistryHealthy;

    return {
      status: allHealthy ? "healthy" : anyHealthy ? "degraded" : "unhealthy",
      mongodb: mongoHealthy,
      toolRegistry: toolRegistryHealthy,
      details: {
        bootstrapped: this.bootstrapped,
        toolCount,
      },
    };
  }

  private assertBootstrapped(): void {
    if (!this.bootstrapped) {
      throw new Error(
        "[AgentRuntime] Runtime not bootstrapped. Call bootstrap() before running sessions."
      );
    }
  }
}

export function getAgentRuntime(): AgentRuntime {
  return AgentRuntime.getInstance();
}
