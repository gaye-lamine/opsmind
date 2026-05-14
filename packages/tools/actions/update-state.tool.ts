import { z } from "zod";
import { createLogger, generateId } from "@opsmind/shared";
import {
  OperationalStateRepository,
} from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("UpdateStateTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const updateStateInputSchema = z.object({
  /**
   * The operation to perform on the operational state.
   */
  operation: z.enum([
    "resolve_anomaly",      // Mark an anomaly as resolved
    "mark_investigating",   // Mark an anomaly as being investigated
    "update_metric",        // Update a metric value in the current state
    "add_summary_note",     // Append a note to the state summary
  ]),
  /**
   * For resolve_anomaly / mark_investigating: the anomaly ID to update.
   */
  anomalyId: z.string().optional(),
  /**
   * For update_metric: the metric name and new value.
   */
  metricName: z.string().optional(),
  metricValue: z.number().optional(),
  /**
   * For add_summary_note: the note to append.
   */
  note: z.string().optional(),
  /**
   * The session ID performing this action (for audit trail).
   */
  sessionId: z.string().optional(),
  /**
   * The decision ID that triggered this state update.
   */
  decisionId: z.string().optional(),
});

type UpdateStateInput = z.infer<typeof updateStateInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const updateStateOutputSchema = z.object({
  operation: z.string(),
  success: z.boolean(),
  updatedAt: z.string(),
  details: z.record(z.unknown()),
  executedVia: z.literal("mongodb-atlas"),
});

type UpdateStateOutput = z.infer<typeof updateStateOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * UpdateStateTool — modifies the operational state in MongoDB Atlas.
 *
 * This is a REAL ACTION tool — it writes to MongoDB Atlas directly.
 * The agent uses this to act on its own operational environment:
 * - Marking anomalies as resolved after taking corrective action
 * - Marking anomalies as "investigating" when launching an investigation
 * - Updating metric values when corrections are applied
 *
 * This closes the feedback loop: the agent doesn't just observe and recommend —
 * it modifies the state of the system it's monitoring.
 *
 * Use when:
 * - An anomaly has been investigated and should be marked as such
 * - A corrective action has been taken and the state should reflect it
 * - The agent needs to record its own actions in the operational state
 */
export class UpdateStateTool extends BaseTool<UpdateStateInput, UpdateStateOutput> {
  readonly name = "update_operational_state";
  readonly description =
    "[ACTION] Updates the operational state in MongoDB Atlas — a REAL write action. " +
    "REQUIRED input: { \"operation\": \"resolve_anomaly\"|\"mark_investigating\"|\"update_metric\"|\"add_summary_note\" }. " +
    "Use operation='mark_investigating' with anomalyId when starting an investigation on a specific anomaly. " +
    "Use operation='resolve_anomaly' with anomalyId when an anomaly has been addressed. " +
    "Use operation='update_metric' with metricName and metricValue when a metric has been corrected. " +
    "This modifies the live operational state in MongoDB Atlas.";
  readonly category = "memory_write" as const;
  readonly inputSchema = updateStateInputSchema;
  readonly outputSchema = updateStateOutputSchema;

  private readonly stateRepo = new OperationalStateRepository();

  protected async run(input: UpdateStateInput): Promise<ToolResult<UpdateStateOutput>> {
    logger.info("Updating operational state in MongoDB Atlas", {
      operation: input.operation,
      anomalyId: input.anomalyId,
      metricName: input.metricName,
      sessionId: input.sessionId,
    });

    const start = Date.now();
    const now = new Date();

    try {
      const current = await this.stateRepo.findCurrent();

      if (!current) {
        return toolFailure(
          "STATE_NOT_FOUND",
          "No current operational state found in MongoDB Atlas",
          Date.now() - start
        );
      }

      let updatedFields: Record<string, unknown> = {};

      switch (input.operation) {
        case "mark_investigating": {
          if (!input.anomalyId) {
            return toolFailure("MISSING_ANOMALY_ID", "anomalyId is required for mark_investigating", Date.now() - start);
          }

          const updatedAnomalies = current.anomalies.map((a) =>
            a.id === input.anomalyId
              ? { ...a, status: "investigating" as const }
              : a
          );

          const anomaly = current.anomalies.find((a) => a.id === input.anomalyId);
          if (!anomaly) {
            return toolFailure("ANOMALY_NOT_FOUND", `Anomaly ${input.anomalyId} not found`, Date.now() - start);
          }

          updatedFields = {
            anomalies: updatedAnomalies,
            summary: `${current.summary} | Agent investigating: ${anomaly.metric} anomaly (${input.sessionId ?? "unknown session"})`,
          };
          break;
        }

        case "resolve_anomaly": {
          if (!input.anomalyId) {
            return toolFailure("MISSING_ANOMALY_ID", "anomalyId is required for resolve_anomaly", Date.now() - start);
          }

          const updatedAnomalies = current.anomalies.map((a) =>
            a.id === input.anomalyId
              ? { ...a, status: "resolved" as const, resolvedAt: now, relatedDecisionId: input.decisionId }
              : a
          );

          const anomaly = current.anomalies.find((a) => a.id === input.anomalyId);
          if (!anomaly) {
            return toolFailure("ANOMALY_NOT_FOUND", `Anomaly ${input.anomalyId} not found`, Date.now() - start);
          }

          updatedFields = {
            anomalies: updatedAnomalies,
            summary: `${current.summary} | Agent resolved: ${anomaly.metric} anomaly`,
          };
          break;
        }

        case "update_metric": {
          if (!input.metricName || input.metricValue === undefined) {
            return toolFailure("MISSING_METRIC", "metricName and metricValue are required for update_metric", Date.now() - start);
          }

          const updatedMetrics = current.metrics.map((m) =>
            m.name === input.metricName
              ? { ...m, value: input.metricValue!, isAnomaly: false, trend: "stable" as const }
              : m
          );

          updatedFields = {
            metrics: updatedMetrics,
            summary: `${current.summary} | Agent updated metric: ${input.metricName} → ${input.metricValue}`,
          };
          break;
        }

        case "add_summary_note": {
          if (!input.note) {
            return toolFailure("MISSING_NOTE", "note is required for add_summary_note", Date.now() - start);
          }

          updatedFields = {
            summary: `${current.summary} | ${input.note}`,
          };
          break;
        }
      }

      await this.stateRepo.updateCurrentState(updatedFields);

      const durationMs = Date.now() - start;

      logger.info("Operational state updated in MongoDB Atlas", {
        operation: input.operation,
        durationMs,
        updatedFields: Object.keys(updatedFields),
      });

      return toolSuccess(
        {
          operation: input.operation,
          success: true,
          updatedAt: now.toISOString(),
          details: {
            updatedFields: Object.keys(updatedFields),
            ...(input.anomalyId !== undefined ? { anomalyId: input.anomalyId } : {}),
            ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
            ...(input.decisionId !== undefined ? { decisionId: input.decisionId } : {}),
          },
          executedVia: "mongodb-atlas",
        },
        durationMs
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Failed to update operational state", error instanceof Error ? error : undefined);

      return toolFailure(
        "STATE_UPDATE_FAILED",
        `Failed to update operational state: ${message}`,
        durationMs
      );
    }
  }
}
