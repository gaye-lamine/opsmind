import { z } from "zod";

/**
 * Schema for Gemini's execution plan output.
 *
 * The planner engine produces a concrete, ordered execution plan
 * from the decomposed goal. Each step specifies exactly which tool
 * to call, with what parameters, and what to do with the result.
 */
export const executionPlanOutputSchema = z.object({
  /**
   * Ordered list of tool invocations to execute.
   */
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1),
        stepNumber: z.number().int().positive(),
        toolName: z.string().min(1),
        description: z.string().min(1),
        /**
         * Tool input parameters — passed directly to the tool registry.
         */
        toolInput: z.record(z.unknown()),
        /**
         * What this step is expected to produce.
         */
        expectedOutput: z.string().min(1),
        /**
         * Whether this step is critical — if it fails, abort the pipeline.
         */
        isCritical: z.boolean(),
        /**
         * Steps that must complete before this one (by stepId).
         */
        dependsOn: z.array(z.string()),
      })
    )
    .min(1)
    .max(10),

  /**
   * Reasoning behind the plan — why these tools in this order.
   */
  planRationale: z.string().min(1),

  /**
   * Estimated total execution time in seconds.
   */
  estimatedDurationSeconds: z.number().positive(),
});

export type ExecutionPlanOutput = z.infer<typeof executionPlanOutputSchema>;
export type ExecutionPlanStep = ExecutionPlanOutput["steps"][number];
