import { createLogger, ERROR_CODES, AgentError } from "@opsmind/shared";
import {
  getAgentRuntime,
  runAnomalyInvestigation,
  runBusinessAnalysis,
  runStrategicPlanning,
  type AgentRunResult,
  type SessionStatusOutput,
} from "@opsmind/agent";
import { type StartAgentSessionDto } from "@opsmind/shared";

const logger = createLogger("AgentService");

/**
 * Agent Service — orchestrates agent session lifecycle for the API layer.
 *
 * Rule §3.2: apps/api NEVER contains reasoning logic.
 * This service is a thin delegation layer to @opsmind/agent.
 */
export class AgentService {
  private readonly runtime = getAgentRuntime();

  /**
   * Starts an agent session asynchronously.
   * Returns the sessionId immediately — pipeline runs in background.
   * Events are streamed via SSE (GET /api/agent/sessions/:id/stream).
   */
  startSessionAsync(dto: StartAgentSessionDto): string {
    logger.info("Starting async agent session via API", {
      goal: dto.goal.slice(0, 100),
      domain: dto.context?.domain,
    });

    return this.runtime.startSessionAsync({
      goal: dto.goal,
      context: dto.context,
    });
  }

  /**
   * Starts an agent session synchronously (legacy — kept for internal use).
   * Selects the appropriate workflow based on goal context.
   */
  async startSession(dto: StartAgentSessionDto): Promise<AgentRunResult> {
    logger.info("Starting agent session via API", {
      goal: dto.goal.slice(0, 100),
      domain: dto.context?.domain,
    });

    const domain = dto.context?.domain?.toLowerCase() ?? "";

    if (domain === "anomaly_investigation" || isAnomalyGoal(dto.goal)) {
      return runAnomalyInvestigation({
        anomalyDescription: dto.goal,
        ...(dto.context?.timeframe !== undefined ? { timeframe: dto.context.timeframe } : {}),
        ...(dto.context?.metrics?.[0] !== undefined ? { affectedMetric: dto.context.metrics[0] } : {}),
      });
    }

    if (domain === "strategic_planning") {
      return runStrategicPlanning({
        goal: dto.goal,
        horizon: "medium_term",
      });
    }

    return runBusinessAnalysis({
      goal: dto.goal,
      ...(dto.context?.domain !== undefined ? { domain: dto.context.domain } : {}),
      ...(dto.context?.timeframe !== undefined ? { timeframe: dto.context.timeframe } : {}),
      ...(dto.context?.metrics !== undefined ? { metrics: dto.context.metrics } : {}),
    });
  }

  /**
   * Returns the current status of a session.
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusOutput> {
    const status = await this.runtime.getSessionStatus(sessionId);

    if (!status) {
      throw new AgentError(
        `Session ${sessionId} not found`,
        ERROR_CODES.AGENT_SESSION_NOT_FOUND,
        { sessionId }
      );
    }

    return status;
  }

  async getRecentSessions(limit: number): Promise<SessionStatusOutput[]> {
    return this.runtime.getRecentSessions(limit);
  }

  async getActiveSessions(): Promise<SessionStatusOutput[]> {
    return this.runtime.getActiveSessions();
  }
}

function isAnomalyGoal(goal: string): boolean {
  const lower = goal.toLowerCase();
  return [
    "increased", "decreased", "dropped", "spike", "anomaly",
    "unusual", "unexpected", "investigate", "why did", "what caused", "%", "percent",
  ].some((kw) => lower.includes(kw));
}
