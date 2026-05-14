import { createLogger } from "@opsmind/shared";
import { getAgentRuntime } from "../../core/runtime/agent-runtime";
import { type AgentRunResult } from "../../interfaces/agent.interfaces";

const logger = createLogger("AnomalyInvestigationWorkflow");

/**
 * Anomaly Investigation Workflow — specialized entry point for anomaly investigation.
 *
 * This workflow is optimized for:
 * - Metric spike/drop investigation
 * - Operational anomaly root cause analysis
 * - Performance degradation investigation
 * - Unexpected behavior analysis
 *
 * The goal is automatically framed as an anomaly investigation,
 * which guides the goal decomposer toward causal analysis steps.
 */

export interface AnomalyInvestigationInput {
  /** Description of the anomaly — e.g. "CAC increased 37% this week" */
  anomalyDescription: string;
  /** The metric that is anomalous */
  affectedMetric?: string;
  /** Magnitude of the anomaly — e.g. "+37%" */
  magnitude?: string;
  /** Time period of the anomaly */
  timeframe?: string;
}

export async function runAnomalyInvestigation(
  input: AnomalyInvestigationInput
): Promise<AgentRunResult> {
  // Frame the goal explicitly as an anomaly investigation
  const goal = buildAnomalyGoal(input);

  logger.info("Starting anomaly investigation workflow", {
    goal: goal.slice(0, 100),
    affectedMetric: input.affectedMetric,
    magnitude: input.magnitude,
  });

  const runtime = getAgentRuntime();

  return runtime.runSession({
    goal,
    context: {
      domain: "anomaly_investigation",
      timeframe: input.timeframe ?? "current_period",
      metrics: input.affectedMetric ? [input.affectedMetric] : [],
    },
  });
}

function buildAnomalyGoal(input: AnomalyInvestigationInput): string {
  const parts: string[] = [input.anomalyDescription];

  if (input.affectedMetric && input.magnitude) {
    parts.push(
      `The affected metric is ${input.affectedMetric} with a change of ${input.magnitude}.`
    );
  }

  if (input.timeframe) {
    parts.push(`This occurred during: ${input.timeframe}.`);
  }

  parts.push(
    "Investigate the root cause, identify contributing factors, assess business impact, and recommend corrective actions."
  );

  return parts.join(" ");
}
