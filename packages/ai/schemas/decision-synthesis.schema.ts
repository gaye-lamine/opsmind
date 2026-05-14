import { z } from "zod";

/**
 * Schema for Gemini's decision synthesis output.
 *
 * The decision engine synthesizes all tool results and reasoning steps
 * into a structured decision with findings, recommendations, and confidence.
 *
 * This is the primary output artifact of the OpsMind reasoning pipeline.
 */
export const decisionSynthesisOutputSchema = z.object({
  /**
   * One-paragraph executive summary of the decision.
   */
  summary: z.string().min(10),

  /**
   * Full reasoning narrative — explains how the agent reached this decision.
   */
  reasoning: z.string().min(50),

  /**
   * Structured findings from the investigation.
   */
  findings: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        severity: z.enum(["info", "warning", "critical"]),
        evidence: z
          .array(z.string())
          .nullable()
          .transform((val) => val ?? []),
        relatedMetrics: z
          .array(z.string())
          .nullable()
          .optional()
          .transform((val) => val ?? undefined),
      })
    )
    .min(1),

  /**
   * Actionable recommendations derived from the findings.
   */
  recommendations: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      rationale: z.string().min(1),
      priority: z.enum(["low", "medium", "high", "immediate"]),
      estimatedImpact: z.string().min(1),
      timeframe: z.string().min(1),
      risks: z
        .array(z.string())
        .nullable()
        .optional()
        .transform((val) => val ?? undefined),
    })
  ),

  /**
   * Confidence score 0–1 for this decision.
   * Based on evidence quality, data completeness, and reasoning coherence.
   */
  confidenceScore: z.number().min(0).max(1),

  /**
   * Explanation of the confidence score.
   */
  confidenceRationale: z.string().min(1),

  /**
   * Root cause analysis — what caused the situation being investigated.
   */
  rootCauseAnalysis: z.string().min(1),

  /**
   * Predicted impact if no action is taken.
   */
  predictedImpactIfUnaddressed: z.string().min(1),
});

export type DecisionSynthesisOutput = z.infer<typeof decisionSynthesisOutputSchema>;
