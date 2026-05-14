import { createLogger } from "@opsmind/shared";
import {
  OperationalStateRepository,
  DecisionRepository,
  ActionRepository,
} from "@opsmind/memory";
import { getAgentRuntime } from "@opsmind/agent";
import { type DashboardStateResponse } from "@opsmind/shared";

const logger = createLogger("DashboardService");

/**
 * Dashboard Service — assembles the operational intelligence dashboard state.
 *
 * Aggregates data from multiple MongoDB collections to build the
 * complete dashboard view: current state, recent decisions, anomalies,
 * pending actions, and system health.
 *
 * Rule §3.2: No business logic here — pure data aggregation for the UI.
 */
export class DashboardService {
  private readonly stateRepo = new OperationalStateRepository();
  private readonly decisionRepo = new DecisionRepository();
  private readonly actionRepo = new ActionRepository();
  private readonly runtime = getAgentRuntime();

  async getDashboardState(): Promise<DashboardStateResponse> {
    logger.debug("Assembling dashboard state");

    const [currentState, recentDecisions, pendingActions, health] =
      await Promise.all([
        this.stateRepo.findCurrent(),
        this.decisionRepo.findRecentFinalized(5),
        this.actionRepo.findPending(),
        this.runtime.healthCheck(),
      ]);

    const operationalState = currentState
      ? {
          id: currentState._id,
          snapshotAt: currentState.snapshotAt,
          metrics: currentState.metrics,
          anomalies: currentState.anomalies,
          activeInvestigations: currentState.activeInvestigations,
          lastDecisionId: currentState.lastDecisionId,
          summary: currentState.summary,
        }
      : buildEmptyOperationalState();

    const decisionSummaries = recentDecisions.map((d) => ({
      id: d._id,
      sessionId: d.sessionId,
      goal: d.goal,
      category: d.category,
      status: d.status,
      confidenceLevel: d.confidenceLevel,
      confidenceScore: d.confidenceScore,
      summary: d.summary,
      recommendationCount: d.recommendations.length,
      createdAt: d.createdAt.toISOString(),
    }));

    const activeAnomalies = (currentState?.anomalies ?? []).filter(
      (a) => a.status !== "resolved" && a.status !== "dismissed"
    );

    return {
      operationalState,
      recentDecisions: decisionSummaries,
      activeAnomalies,
      pendingActions: pendingActions.map((a) => ({
        id: a._id,
        title: a.title,
        description: a.description,
        rationale: a.rationale,
        priority: a.priority,
        status: a.status,
        estimatedImpact: a.estimatedImpact,
        timeframe: a.timeframe,
        risks: a.risks,
      })),
      systemHealth: {
        status: health.status,
        agentStatus: health.bootstrapped ? "ready" : "not_bootstrapped",
        memoryStatus: health.mongodb ? "connected" : "disconnected",
        lastActivityAt: new Date().toISOString(),
      },
    };
  }
}

function buildEmptyOperationalState(): DashboardStateResponse["operationalState"] {
  return {
    id: "none",
    snapshotAt: new Date(),
    metrics: [],
    anomalies: [],
    activeInvestigations: [],
    summary: "No operational state available. Run an agent session to initialize.",
  };
}
