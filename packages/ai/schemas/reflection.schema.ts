import { z } from "zod";

/**
 * Schema for Gemini's reflection output.
 *
 * The reflection loop evaluates the quality of a generated decision
 * before it is finalized. This is mandatory — reflection is NOT optional (§2.4).
 *
 * The reflection engine acts as a critic: it challenges the decision,
 * identifies weaknesses, and either approves it or flags it for revision.
 */
export interface ReflectionOutput {
  overallAssessment: "approved" | "approved_with_notes" | "needs_revision";
  confidenceAssessment: string;
  adjustedConfidenceScore: number;
  reasoningQuality: "poor" | "adequate" | "good" | "excellent";
  reasoningQualityNotes: string;
  identifiedRisks: string[];
  alternativeApproaches: string[];
  limitations: string[];
  improvementSuggestions: string[];
  overallScore: number;
  revisionRequirements: string[];
}

/**
 * Schema for Gemini's reflection output.
 * Typed to ensure the output matches ReflectionOutput interface.
 */
export const reflectionOutputSchema: z.ZodType<ReflectionOutput, z.ZodTypeDef, any> = z.object({
  overallAssessment: z.enum(["approved", "approved_with_notes", "needs_revision"]),
  confidenceAssessment: z.string().min(1),
  adjustedConfidenceScore: z.number().min(0).max(1),
  reasoningQuality: z.enum(["poor", "adequate", "good", "excellent"]),
  reasoningQualityNotes: z.string().min(1),
  identifiedRisks: z.union([z.array(z.string()), z.null()]).transform((v) => v ?? []).default([]),
  alternativeApproaches: z.union([z.array(z.string()), z.null()]).transform((v) => v ?? []).default([]),
  limitations: z.union([z.array(z.string()), z.null()]).transform((v) => v ?? []).default([]),
  improvementSuggestions: z.union([z.array(z.string()), z.null()]).transform((v) => v ?? []).default([]),
  overallScore: z.number().min(0).max(1),
  revisionRequirements: z.union([z.array(z.string()), z.null()]).transform((v) => v ?? []).default([]),
});
