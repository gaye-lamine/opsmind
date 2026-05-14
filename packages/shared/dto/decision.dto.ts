import { z } from "zod";

/**
 * Decision DTOs — validated data transfer objects for the decision domain.
 * Used at API boundaries and between agent layers.
 */

// ─── Create Decision ──────────────────────────────────────────────────────────

export const createDecisionSchema = z.object({
  sessionId: z.string().min(1),
  goal: z.string().min(1).max(2000),
  category: z.enum([
    "anomaly_resolution",
    "strategic_recommendation",
    "operational_action",
    "risk_mitigation",
    "performance_optimization",
    "monitoring_alert",
  ]),
  summary: z.string().min(1).max(5000),
  reasoning: z.string().min(1),
  findings: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      severity: z.enum(["info", "warning", "critical"]),
      evidence: z.array(z.string()),
      relatedMetrics: z.array(z.string()).optional(),
    })
  ),
  recommendations: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      rationale: z.string().min(1),
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
    })
  ),
  confidenceScore: z.number().min(0).max(1),
  toolsUsed: z.array(z.string()),
  memoryReferences: z.array(z.string()),
  reasoningTrace: z.object({
    steps: z.array(
      z.object({
        step: z.string(),
        input: z.string(),
        output: z.string(),
        durationMs: z.number(),
        timestamp: z.coerce.date(),
      })
    ),
    totalDurationMs: z.number(),
    modelUsed: z.string(),
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
  }),
});

export type CreateDecisionDto = z.infer<typeof createDecisionSchema>;

// ─── Update Action Status ─────────────────────────────────────────────────────

export const updateActionStatusSchema = z.object({
  status: z.enum([
    "recommended",
    "acknowledged",
    "in_progress",
    "completed",
    "dismissed",
  ]),
  notes: z.string().max(1000).optional(),
});

export type UpdateActionStatusDto = z.infer<typeof updateActionStatusSchema>;

// ─── Decision Query ───────────────────────────────────────────────────────────

export const decisionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  category: z
    .enum([
      "anomaly_resolution",
      "strategic_recommendation",
      "operational_action",
      "risk_mitigation",
      "performance_optimization",
      "monitoring_alert",
    ])
    .optional(),
  status: z
    .enum(["draft", "pending_reflection", "reflected", "finalized", "superseded"])
    .optional(),
  sessionId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type DecisionQueryDto = z.infer<typeof decisionQuerySchema>;
