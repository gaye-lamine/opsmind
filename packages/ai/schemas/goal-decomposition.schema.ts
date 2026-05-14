import { z } from "zod";

/**
 * Schema for Gemini's goal decomposition output.
 *
 * The goal decomposition engine takes a raw user goal and produces
 * a structured breakdown: category classification, decomposed reasoning steps,
 * required tools, and initial hypotheses.
 *
 * Rule §2.3: ALL AI outputs MUST be schema-validated before use.
 */
export const goalDecompositionOutputSchema = z.object({
  /**
   * Classified goal category — determines which workflow to execute.
   */
  category: z.enum([
    "anomaly_investigation",
    "business_analysis",
    "strategic_planning",
    "operational_monitoring",
    "risk_assessment",
    "performance_review",
  ]),

  /**
   * Refined, structured version of the raw goal.
   */
  refinedGoal: z.string().min(1),

  /**
   * Ordered list of reasoning steps to execute.
   * Each step maps to a pipeline stage.
   */
  reasoningSteps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        stepType: z.enum([
          "context_assembly",
          "data_retrieval",
          "anomaly_analysis",
          "pattern_matching",
          "causal_analysis",
          "impact_assessment",
          "recommendation_generation",
          "risk_evaluation",
        ]),
        description: z.string().min(1),
        requiredTools: z
          .array(z.string())
          .nullable()
          .transform((val) => val ?? []),
        expectedOutput: z.string().min(1),
      })
    )
    .min(1)
    .max(8),

  /**
   * Initial hypotheses about the problem — used to guide investigation.
   */
  initialHypotheses: z
    .array(z.string())
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : ["No specific hypotheses identified"])),

  /**
   * Key metrics or entities that should be investigated.
   */
  focusAreas: z
    .array(z.string())
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : ["General business metrics"])),

  /**
   * Estimated complexity — influences how many reasoning steps to allocate.
   */
  complexity: z.enum(["low", "medium", "high"]),

  /**
   * Priority level — influences urgency of recommendations.
   */
  priority: z.enum(["low", "medium", "high", "critical"]),
});

export type GoalDecompositionOutput = z.infer<typeof goalDecompositionOutputSchema>;
