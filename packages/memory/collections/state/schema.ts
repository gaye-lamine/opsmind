import { z } from "zod";

/**
 * MongoDB document schema for the `operational_state` collection.
 *
 * Operational state is a point-in-time snapshot of the business environment.
 * The agent reads this to understand the current situation before reasoning.
 * Each snapshot is immutable — new snapshots are inserted, not updates.
 * This creates a full history of how the business state evolved over time.
 */

const businessMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  trend: z.enum(["up", "down", "stable", "volatile"]),
  changePercent: z.number().optional(),
  period: z.string(),
  isAnomaly: z.boolean(),
  // Baseline for anomaly detection
  baseline: z
    .object({
      mean: z.number(),
      stdDev: z.number(),
      sampleSize: z.number(),
    })
    .optional(),
});

const detectedAnomalySchema = z.object({
  id: z.string(),
  metric: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["detected", "investigating", "resolved", "dismissed"]),
  detectedAt: z.date(),
  resolvedAt: z.date().optional(),
  relatedDecisionId: z.string().optional(),
  evidence: z.array(z.string()),
  // Z-score or deviation magnitude
  deviationMagnitude: z.number().optional(),
});

export const operationalStateDocumentSchema = z.object({
  _id: z.string(),
  // Snapshot timestamp — each document is a point-in-time record
  snapshotAt: z.date(),
  // Whether this is the current active state
  isCurrent: z.boolean(),
  metrics: z.array(businessMetricSchema),
  anomalies: z.array(detectedAnomalySchema),
  activeInvestigations: z.array(z.string()), // session IDs
  lastDecisionId: z.string().optional(),
  summary: z.string(),
  // Source of this state snapshot (manual, agent, scheduled)
  source: z.enum(["manual", "agent", "scheduled", "seed"]),
  // Session that created this snapshot (if agent-generated)
  sessionId: z.string().optional(),
});

export type OperationalStateDocument = z.infer<
  typeof operationalStateDocumentSchema
>;

export const insertOperationalStateSchema = operationalStateDocumentSchema;
export type InsertOperationalStateDocument = OperationalStateDocument;

export const updateOperationalStateSchema = operationalStateDocumentSchema
  .omit({ _id: true, snapshotAt: true, source: true })
  .partial();
export type UpdateOperationalStateDocument = z.infer<
  typeof updateOperationalStateSchema
>;
