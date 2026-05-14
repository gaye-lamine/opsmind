import { createLogger } from "@opsmind/shared";
import { getGeminiClient } from "../../gemini/client";
import { executionPlanOutputSchema, type ExecutionPlanOutput } from "../../schemas/execution-plan.schema";
import { type GoalDecompositionOutput } from "../../schemas/goal-decomposition.schema";
import {
  PLANNER_SYSTEM_PROMPT,
  buildPlannerUserPrompt,
} from "../../prompts/planner/planner.prompt";

const logger = createLogger("PlannerEngine");

/**
 * Planner Engine — second step of the reasoning pipeline.
 *
 * Takes the decomposed goal and available tools, and produces
 * a concrete, ordered execution plan with specific tool calls.
 *
 * The planner bridges the gap between "what to investigate" (goal decomposition)
 * and "how to investigate it" (tool execution).
 *
 * Key responsibility: map each reasoning step to a specific tool invocation
 * with the exact parameters needed.
 */

export interface AvailableTool {
  name: string;
  description: string;
  category: string;
}

export class PlannerEngine {
  private readonly client = getGeminiClient();

  async plan(
    decomposedGoal: GoalDecompositionOutput,
    availableTools: AvailableTool[],
    operationalContext: string,
    memoryContext: string
  ): Promise<ExecutionPlanOutput> {
    logger.info("Building execution plan", {
      category: decomposedGoal.category,
      stepCount: decomposedGoal.reasoningSteps.length,
      availableTools: availableTools.map((t) => t.name),
    });

    const userPrompt = buildPlannerUserPrompt({
      decomposedGoal,
      availableTools,
      memoryContext,
      operationalContext,
    });

    const result = await this.client.generateStructured(
      {
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.1, // Low temperature for deterministic planning
      },
      executionPlanOutputSchema
    );

    // Validate that all tool names in the plan exist in available tools
    const availableToolNames = new Set(availableTools.map((t) => t.name));
    const invalidTools = result.data.steps
      .map((s) => s.toolName)
      .filter((name) => !availableToolNames.has(name));

    if (invalidTools.length > 0) {
      logger.warn("Plan references unknown tools — filtering", { invalidTools });
      // Filter out steps with unknown tools rather than failing
      const validSteps = result.data.steps.filter((s) =>
        availableToolNames.has(s.toolName)
      );

      if (validSteps.length === 0) {
        throw new Error(
          `Planner produced no valid steps. All referenced tools are unknown: ${invalidTools.join(", ")}`
        );
      }

      logger.info("Execution plan built (filtered)", {
        originalSteps: result.data.steps.length,
        validSteps: validSteps.length,
        durationMs: result.durationMs,
      });

      return { ...result.data, steps: validSteps };
    }

    logger.info("Execution plan built", {
      stepCount: result.data.steps.length,
      estimatedDurationSeconds: result.data.estimatedDurationSeconds,
      durationMs: result.durationMs,
    });

    return result.data;
  }
}
