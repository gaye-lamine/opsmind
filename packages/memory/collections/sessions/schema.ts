import { z } from "zod";

/**
 * MongoDB document schema for the `sessions` collection.
 *
 * A Session represents a single agent execution run — from goal input
 * to final decision output. Sessions are the top-level unit of agent work.
 * They link all decisions, logs, and tool calls that happened during one investigation.
 */

const toolCallSchema = z.object({
  toolName: z.string(),
  toolId: z.string(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  status: z.enum(["pending", "success", "failed"]),
  durationMs: z.number().optional(),
  error: z.string().optional(),
});

const reasoningStepResultSchema = z.object({
  stepId: z.string(),
  stepType: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  reasoning: z.string(),
  durationMs: z.number(),
  timestamp: z.date(),
  error: z.string().optional(),
});

export const sessionDocumentSchema = z.object({
  _id: z.string(),
  goal: z.string(),
  category: z.enum([
    "anomaly_investigation",
    "business_analysis",
    "strategic_planning",
    "operational_monitoring",
    "risk_assessment",
    "performance_review",
  ]),
  status: z.enum([
    "initializing",
    "running",
    "reflecting",
    "completed",
    "failed",
    "timeout",
  ]),
  currentStep: z.string(),
  stepCount: z.number().int().nonnegative(),
  completedSteps: z.array(reasoningStepResultSchema),
  toolCalls: z.array(toolCallSchema),
  decisionId: z.string().optional(),
  // Business context provided at session start
  context: z
    .object({
      domain: z.string().optional(),
      timeframe: z.string().optional(),
      metrics: z.array(z.string()).optional(),
    })
    .optional(),
  // Memory references used during this session
  memoryReferences: z.array(z.string()),
  // Error details if session failed
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      step: z.string().optional(),
    })
    .optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  durationMs: z.number().optional(),
});

export type SessionDocument = z.infer<typeof sessionDocumentSchema>;

export const insertSessionSchema = sessionDocumentSchema;
export type InsertSessionDocument = SessionDocument;

export const updateSessionSchema = sessionDocumentSchema
  .omit({ _id: true, goal: true, startedAt: true })
  .partial();
export type UpdateSessionDocument = z.infer<typeof updateSessionSchema>;
