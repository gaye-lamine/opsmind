import { createLogger } from "@opsmind/shared";
import { OperationalStateRepository } from "@opsmind/memory";
import { getAgentRuntime } from "../../core/runtime/agent-runtime";
import { getSseEventStore } from "../../core/sse-event-store";

const logger = createLogger("MonitoringLoop");

/**
 * Monitoring Loop — autonomous anomaly detection and investigation.
 *
 * Implements the OBSERVE → DETECT → INVESTIGATE phase of the agent loop.
 *
 * On each check:
 * 1. Reads the current operational state from MongoDB
 * 2. Identifies anomalies with severity >= "high" that are not yet being investigated
 * 3. Launches an autonomous investigation session for each qualifying anomaly
 * 4. Returns a summary of what was detected and launched
 *
 * This is what makes OpsMind autonomous — it does not wait for human input
 * to detect and investigate operational problems.
 *
 * Design:
 * - Stateless: each check is independent
 * - Non-blocking: investigations run in background via startSessionAsync
 * - Safe: skips anomalies already under active investigation
 * - Traceable: all launched sessions are tracked in MongoDB
 */

export interface MonitoringCheckResult {
  checkedAt: Date;
  anomaliesDetected: number;
  investigationsLaunched: number;
  investigationsSkipped: number;
  launchedSessionIds: string[];
  anomalySummary: Array<{
    metric: string;
    severity: string;
    description: string;
    sessionId?: string;
    skipped: boolean;
    skipReason?: string;
  }>;
}

/** Minimum severity to trigger autonomous investigation */
const AUTO_INVESTIGATE_SEVERITY = new Set(["high", "critical"]);

export class MonitoringLoop {
  private readonly stateRepo = new OperationalStateRepository();

  /**
   * Performs a single monitoring check.
   * Detects anomalies and launches investigations for qualifying ones.
   */
  async check(): Promise<MonitoringCheckResult> {
    const checkedAt = new Date();
    const runtime = getAgentRuntime();
    const eventStore = getSseEventStore();

    logger.info("Starting monitoring check");

    const currentState = await this.stateRepo.findCurrent();

    if (currentState === null) {
      logger.warn("No operational state found — skipping monitoring check");
      return {
        checkedAt,
        anomaliesDetected: 0,
        investigationsLaunched: 0,
        investigationsSkipped: 0,
        launchedSessionIds: [],
        anomalySummary: [],
      };
    }

    const activeInvestigations = new Set(currentState.activeInvestigations);

    // Filter anomalies that qualify for autonomous investigation
    const qualifyingAnomalies = currentState.anomalies.filter(
      (a) =>
        AUTO_INVESTIGATE_SEVERITY.has(a.severity) &&
        a.status === "detected"
    );

    logger.info("Monitoring check: anomalies found", {
      total: currentState.anomalies.length,
      qualifying: qualifyingAnomalies.length,
      activeInvestigations: activeInvestigations.size,
    });

    const anomalySummary: MonitoringCheckResult["anomalySummary"] = [];
    const launchedSessionIds: string[] = [];
    let investigationsLaunched = 0;
    let investigationsSkipped = 0;

    for (const anomaly of qualifyingAnomalies) {
      // Skip if already being investigated
      if (activeInvestigations.size > 0) {
        // Check if any active session is investigating this metric
        // We use a heuristic: if there are active investigations, skip to avoid
        // launching duplicate investigations for the same anomaly
        investigationsSkipped++;
        anomalySummary.push({
          metric: anomaly.metric,
          severity: anomaly.severity,
          description: anomaly.description,
          skipped: true,
          skipReason: "Active investigation already running",
        });
        continue;
      }

      // Build investigation goal
      const goal = buildInvestigationGoal(anomaly);

      logger.info("Launching autonomous investigation", {
        metric: anomaly.metric,
        severity: anomaly.severity,
        goal: goal.slice(0, 100),
      });

      try {
        const sessionId = runtime.startSessionAsync({
          goal,
          context: {
            domain: "anomaly_investigation",
            metrics: [anomaly.metric],
          },
        });

        launchedSessionIds.push(sessionId);
        investigationsLaunched++;
        activeInvestigations.add(sessionId); // prevent duplicate launches in same check

        anomalySummary.push({
          metric: anomaly.metric,
          severity: anomaly.severity,
          description: anomaly.description,
          sessionId,
          skipped: false,
        });

        logger.info("Autonomous investigation launched", {
          metric: anomaly.metric,
          sessionId,
        });
      } catch (err) {
        logger.error("Failed to launch autonomous investigation", err instanceof Error ? err : undefined, {
          metric: anomaly.metric,
        });

        investigationsSkipped++;
        anomalySummary.push({
          metric: anomaly.metric,
          severity: anomaly.severity,
          description: anomaly.description,
          skipped: true,
          skipReason: err instanceof Error ? err.message : "Launch failed",
        });
      }
    }

    const result: MonitoringCheckResult = {
      checkedAt,
      anomaliesDetected: qualifyingAnomalies.length,
      investigationsLaunched,
      investigationsSkipped,
      launchedSessionIds,
      anomalySummary,
    };

    logger.info("Monitoring check complete", {
      anomaliesDetected: result.anomaliesDetected,
      investigationsLaunched: result.investigationsLaunched,
      investigationsSkipped: result.investigationsSkipped,
    });

    return result;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _monitoringLoop: MonitoringLoop | null = null;

export function getMonitoringLoop(): MonitoringLoop {
  if (_monitoringLoop === null) {
    _monitoringLoop = new MonitoringLoop();
  }
  return _monitoringLoop;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInvestigationGoal(anomaly: {
  metric: string;
  severity: string;
  description: string;
  deviationMagnitude?: number;
}): string {
  const parts: string[] = [anomaly.description];

  if (anomaly.deviationMagnitude !== undefined) {
    parts.push(
      `The deviation magnitude is ${anomaly.deviationMagnitude.toFixed(1)} standard deviations from baseline.`
    );
  }

  parts.push(
    `Severity: ${anomaly.severity}. ` +
      "Investigate the root cause, identify contributing factors, assess business impact, and recommend corrective actions."
  );

  return parts.join(" ");
}
