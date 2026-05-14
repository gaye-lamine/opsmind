import { z } from "zod";

/**
 * MongoDB document schema for the `execution_logs` collection.
 *
 * Execution logs capture every significant event in the agent's reasoning pipeline.
 * They are the audit trail — essential for debugging, traceability, and
 * understanding why the agent made specific decisions.
 *
 * Logs are append-only. Never update or delete log entries.
 */

export const executionLogDocumentSchema = z.object({
  _id: z.string(),
  sessionId: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  // Which pipeline step generated this log
  step: z.string(),
  message: z.string(),
  // Structured data attached to this log entry
  data: z.record(z.unknown()).optional(),
  // If this log is associated with a specific tool call
  toolCallId: z.string().optional(),
  // If this log is associated with a specific decision
  decisionId: z.string().optional(),
  // Duration of the operation that generated this log
  durationMs: z.number().optional(),
  // Error details for error-level logs
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  timestamp: z.date(),
});

export type ExecutionLogDocument = z.infer<typeof executionLogDocumentSchema>;

// Logs are insert-only — no update schema
export const insertExecutionLogSchema = executionLogDocumentSchema;
export type InsertExecutionLogDocument = ExecutionLogDocument;
