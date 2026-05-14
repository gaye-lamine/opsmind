import { createLogger } from "@opsmind/shared";
import { getAgentRuntime } from "../../core/runtime/agent-runtime";
import { type AgentRunResult } from "../../interfaces/agent.interfaces";

const logger = createLogger("StrategicPlanningWorkflow");

/**
 * Strategic Planning Workflow — specialized entry point for strategic planning goals.
 *
 * This workflow is optimized for:
 * - Growth strategy development
 * - Market opportunity assessment
 * - Resource allocation decisions
 * - Operational improvement planning
 * - Risk mitigation planning
 */

export interface StrategicPlanningInput {
  goal: string;
  horizon?: "short_term" | "medium_term" | "long_term";
  constraints?: string[];
  objectives?: string[];
}

export async function runStrategicPlanning(
  input: StrategicPlanningInput
): Promise<AgentRunResult> {
  const enrichedGoal = buildStrategicGoal(input);

  logger.info("Starting strategic planning workflow", {
    goal: enrichedGoal.slice(0, 100),
    horizon: input.horizon,
  });

  const runtime = getAgentRuntime();

  return runtime.runSession({
    goal: enrichedGoal,
    context: {
      domain: "strategic_planning",
      timeframe: input.horizon ?? "medium_term",
      metrics: [],
    },
  });
}

function buildStrategicGoal(input: StrategicPlanningInput): string {
  const parts: string[] = [input.goal];

  if (input.horizon) {
    const horizonLabel = {
      short_term: "the next 30–90 days",
      medium_term: "the next 3–6 months",
      long_term: "the next 6–18 months",
    }[input.horizon];
    parts.push(`Focus on ${horizonLabel}.`);
  }

  if (input.constraints && input.constraints.length > 0) {
    parts.push(`Constraints to consider: ${input.constraints.join(", ")}.`);
  }

  if (input.objectives && input.objectives.length > 0) {
    parts.push(`Key objectives: ${input.objectives.join(", ")}.`);
  }

  return parts.join(" ");
}
