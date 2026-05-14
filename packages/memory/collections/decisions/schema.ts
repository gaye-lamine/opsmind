import { z } from "zod";

/**
 * MongoDB document schema for the `decisions` collection.
 *
 * A Decision document is the primary artifact of the OpsMind reasoning pipeline.
 * It stores the full reasoning trace, findings, recommendations, and reflection
 * so future reasoning can learn from past decisions.
 *
 * This is NOT a simple CRUD record — it is organizational memory.
 */

const findingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  evidence: z.array(z.string()),
  relatedMetrics: z.array(z.string()).optional(),
});

const actionRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  priority: z.enum(["low", "medium", "high", "immediate"]),
  status: z.enum([
    "recommended",
    "acknowledged",
    "in_progress",
    "completed",
    "dismissed",
  ]),
  estimatedImpact: z.string(),
  timeframe: z.string(),
  risks: z.array(z.string()).optional(),
});

const decisionReflectionSchema = z.object({
  confidenceAssessment: z.string(),
  reasoningQuality: z.string(),
  identifiedRisks: z.array(z.string()),
  alternativeApproaches: z.array(z.string()),
  limitations: z.array(z.string()),
  improvementSuggestions: z.array(z.string()),
  overallScore: z.number().min(0).max(1),
});

const reasoningTraceStepSchema = z.object({
  step: z.string(),
  input: z.string(),
  output: z.string(),
  durationMs: z.number(),
  timestamp: z.date(),
});

const reasoningTraceSchema = z.object({
  steps: z.array(reasoningTraceStepSchema),
  totalDurationMs: z.number(),
  modelUsed: z.string(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
});

export const decisionDocumentSchema = z.object({
  _id: z.string(),
  sessionId: z.string(),
  goal: z.string(),
  category: z.enum([
    "anomaly_resolution",
    "strategic_recommendation",
    "operational_action",
    "risk_mitigation",
    "performance_optimization",
    "monitoring_alert",
  ]),
  status: z.enum([
    "draft",
    "pending_reflection",
    "reflected",
    "finalized",
    "superseded",
  ]),
  summary: z.string(),
  reasoning: z.string(),
  findings: z.array(findingSchema),
  recommendations: z.array(actionRecommendationSchema),
  reflection: decisionReflectionSchema.optional(),
  confidenceScore: z.number().min(0).max(1),
  confidenceLevel: z.enum(["low", "medium", "high", "very_high"]),
  reasoningTrace: reasoningTraceSchema,
  toolsUsed: z.array(z.string()),
  memoryReferences: z.array(z.string()),
  // Embedding for vector similarity search
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DecisionDocument = z.infer<typeof decisionDocumentSchema>;

// Insert shape — _id is provided by the caller (generateDecisionId)
export const insertDecisionSchema = decisionDocumentSchema;
export type InsertDecisionDocument = DecisionDocument;

// Update shape — partial, excludes immutable fields
export const updateDecisionSchema = decisionDocumentSchema
  .omit({ _id: true, sessionId: true, createdAt: true })
  .partial();
export type UpdateDecisionDocument = z.infer<typeof updateDecisionSchema>;
