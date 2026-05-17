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

    const [currentState, recentDecisions, pendingActions, health, insights] =
      await Promise.all([
        this.stateRepo.findCurrent(),
        this.decisionRepo.findRecentFinalized(5),
        this.actionRepo.findPending(),
        this.runtime.healthCheck(),
        this.actionRepo.getOperationalInsights()
      ]);

    const operationalState = currentState
      ? {
          id: currentState._id,
          snapshotAt: currentState.snapshotAt,
          metrics: currentState.metrics.map(m => cleanObject({
            name: m.name,
            value: m.value,
            unit: m.unit,
            trend: m.trend,
            period: m.period,
            isAnomaly: m.isAnomaly,
            changePercent: m.changePercent,
            baseline: m.baseline ? cleanObject(m.baseline) : undefined
          }) as any),
          anomalies: currentState.anomalies.map(a => cleanObject({
            id: a.id,
            metric: a.metric,
            description: a.description,
            severity: a.severity,
            status: a.status,
            detectedAt: a.detectedAt,
            evidence: a.evidence,
            resolvedAt: a.resolvedAt,
            deviationMagnitude: a.deviationMagnitude,
            relatedDecisionId: a.relatedDecisionId
          }) as any),
          activeInvestigations: currentState.activeInvestigations,
          lastDecisionId: currentState.lastDecisionId,
          summary: currentState.summary,
        }
      : buildEmptyOperationalState();

    const decisionSummaries = recentDecisions.map((d) => cleanObject({
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
      searchScore: (d as any).searchScore,
      searchType: (d as any).searchType,
    }) as any);

    const activeAnomalies = (operationalState.anomalies as any[]).filter(
      (a) => a.status !== "resolved" && a.status !== "dismissed"
    );

    return {
      operationalState: operationalState as any,
      recentDecisions: decisionSummaries,
      activeAnomalies: activeAnomalies as any,
      pendingActions: pendingActions.map((a) => cleanObject({
        id: a._id,
        title: a.title,
        description: a.description,
        rationale: a.rationale,
        priority: a.priority,
        status: a.status,
        estimatedImpact: a.estimatedImpact,
        timeframe: a.timeframe,
        risks: a.risks,
      }) as any),
      systemHealth: {
        status: health.status === "unhealthy" ? "critical" : health.status,
        agentStatus: health.toolRegistry ? "ready" : "not_bootstrapped",
        memoryStatus: health.mongodb ? "connected" : "disconnected",
        lastActivityAt: new Date().toISOString(),
      },
      insights
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

function cleanObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}
