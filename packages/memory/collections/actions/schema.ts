import { z } from "zod";

/**
 * MongoDB document schema for the `actions` collection.
 *
 * Actions are the operational outputs of the agent — what it recommends
 * and what actually gets done. Tracking action outcomes closes the feedback
 * loop: the agent can learn which recommendations led to positive results.
 */

export const actionDocumentSchema = z.object({
  _id: z.string(),
  decisionId: z.string(),
  sessionId: z.string(),
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
  // Outcome tracking — filled in after action is completed/dismissed
  outcome: z
    .object({
      wasSuccessful: z.boolean(),
      notes: z.string(),
      observedAt: z.date(),
      // Quantified impact if measurable
      measuredImpact: z.string().optional(),
    })
    .optional(),
  // Status change history for audit trail
  statusHistory: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      changedAt: z.date(),
      notes: z.string().optional(),
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ActionDocument = z.infer<typeof actionDocumentSchema>;

export const insertActionSchema = actionDocumentSchema;
export type InsertActionDocument = ActionDocument;

export const updateActionSchema = actionDocumentSchema
  .omit({ _id: true, decisionId: true, sessionId: true, createdAt: true })
  .partial();
export type UpdateActionDocument = z.infer<typeof updateActionSchema>;
