import { createLogger } from "@opsmind/shared";
import { getAgentRuntime } from "../../core/runtime/agent-runtime";
import { type AgentRunResult } from "../../interfaces/agent.interfaces";

const logger = createLogger("BusinessAnalysisWorkflow");

/**
 * Business Analysis Workflow — specialized entry point for business analysis goals.
 *
 * This workflow is optimized for:
 * - Revenue and growth analysis
 * - Customer acquisition cost investigation
 * - Churn and retention analysis
 * - Unit economics review
 * - Competitive positioning assessment
 *
 * It pre-configures the agent context with business-specific framing
 * to improve goal decomposition quality.
 */

export interface BusinessAnalysisInput {
  goal: string;
  domain?: string;
  timeframe?: string;
  metrics?: string[];
}

export async function runBusinessAnalysis(
  input: BusinessAnalysisInput
): Promise<AgentRunResult> {
  logger.info("Starting business analysis workflow", {
    goal: input.goal.slice(0, 100),
    domain: input.domain,
    timeframe: input.timeframe,
  });

  const runtime = getAgentRuntime();

  return runtime.runSession({
    goal: input.goal,
    context: {
      domain: input.domain ?? "business_operations",
      timeframe: input.timeframe ?? "current_period",
      metrics: input.metrics ?? [],
    },
  });
}
