import { z } from "zod";
import { createLogger, generateLogId } from "@opsmind/shared";
import { ExecutionLogRepository, ActionRepository } from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../../registry/tool.interface";

const logger = createLogger("ActionLogTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const actionLogInputSchema = z.discriminatedUnion("operation", [
  /**
   * Log a pipeline execution event — called at each reasoning step.
   */
  z.object({
    operation: z.literal("log_execution"),
    sessionId: z.string(),
    level: z.enum(["debug", "info", "warn", "error"]),
    step: z.string(),
    message: z.string(),
    data: z.record(z.unknown()).optional(),
    toolCallId: z.string().optional(),
    decisionId: z.string().optional(),
    durationMs: z.number().optional(),
  }),

  /**
   * Log an error with full context — called when a pipeline step fails.
   */
  z.object({
    operation: z.literal("log_error"),
    sessionId: z.string(),
    step: z.string(),
    message: z.string(),
    error: z.object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    }),
    data: z.record(z.unknown()).optional(),
  }),

  /**
   * Record the outcome of an action recommendation.
   * Closes the feedback loop — future reasoning learns from this.
   */
  z.object({
    operation: z.literal("record_action_outcome"),
    actionId: z.string(),
    wasSuccessful: z.boolean(),
    notes: z.string(),
    measuredImpact: z.string().optional(),
  }),

  /**
   * Update the status of an action recommendation.
   */
  z.object({
    operation: z.literal("update_action_status"),
    actionId: z.string(),
    newStatus: z.enum([
      "recommended",
      "acknowledged",
      "in_progress",
      "completed",
      "dismissed",
    ]),
    notes: z.string().optional(),
  }),
]);

type ActionLogInput = z.infer<typeof actionLogInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const actionLogOutputSchema = z.object({
  operation: z.string(),
  success: z.boolean(),
  logId: z.string().optional(),
  timestamp: z.string(),
});

type ActionLogOutput = z.infer<typeof actionLogOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * ActionLogTool — logs execution events and tracks action outcomes.
 *
 * Serves two purposes:
 * 1. Execution logging: full audit trail of every reasoning step
 * 2. Action tracking: records outcomes to close the feedback loop
 *
 * Logs are append-only — they are never updated or deleted.
 * This ensures complete traceability of the agent's reasoning history.
 */
export class ActionLogTool extends BaseTool<ActionLogInput, ActionLogOutput> {
  readonly name = "action_log";
  readonly description =
    "Logs execution events and tracks action outcomes. " +
    "Use 'log_execution' to record pipeline step events. " +
    "Use 'log_error' to record failures with full context. " +
    "Use 'record_action_outcome' to close the feedback loop after an action completes. " +
    "Use 'update_action_status' to track action progress.";
  readonly category = "memory_write" as const;
  readonly inputSchema = actionLogInputSchema;
  readonly outputSchema = actionLogOutputSchema;

  private readonly logRepo = new ExecutionLogRepository();
  private readonly actionRepo = new ActionRepository();

  protected async run(input: ActionLogInput): Promise<ToolResult<ActionLogOutput>> {
    const now = new Date();

    switch (input.operation) {
      case "log_execution":
        return this.handleLogExecution(input, now);
      case "log_error":
        return this.handleLogError(input, now);
      case "record_action_outcome":
        return this.handleRecordOutcome(input, now);
      case "update_action_status":
        return this.handleUpdateActionStatus(input, now);
    }
  }

  private async handleLogExecution(
    input: Extract<ActionLogInput, { operation: "log_execution" }>,
    now: Date
  ): Promise<ToolResult<ActionLogOutput>> {
    const logId = generateLogId();

    await this.logRepo.appendLog({
      _id: logId,
      sessionId: input.sessionId,
      level: input.level,
      step: input.step,
      message: input.message,
      ...(input.data !== undefined ? { data: input.data } : {}),
      ...(input.toolCallId !== undefined ? { toolCallId: input.toolCallId } : {}),
      ...(input.decisionId !== undefined ? { decisionId: input.decisionId } : {}),
      ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
      timestamp: now,
    });

    return toolSuccess(
      { operation: "log_execution", success: true, logId, timestamp: now.toISOString() },
      0
    );
  }

  private async handleLogError(
    input: Extract<ActionLogInput, { operation: "log_error" }>,
    now: Date
  ): Promise<ToolResult<ActionLogOutput>> {
    const logId = generateLogId();

    logger.warn("Agent error logged", {
      sessionId: input.sessionId,
      step: input.step,
      message: input.message,
    });

    await this.logRepo.appendLog({
      _id: logId,
      sessionId: input.sessionId,
      level: "error",
      step: input.step,
      message: input.message,
      error: input.error,
      ...(input.data !== undefined ? { data: input.data } : {}),
      timestamp: now,
    });

    return toolSuccess(
      { operation: "log_error", success: true, logId, timestamp: now.toISOString() },
      0
    );
  }

  private async handleRecordOutcome(
    input: Extract<ActionLogInput, { operation: "record_action_outcome" }>,
    now: Date
  ): Promise<ToolResult<ActionLogOutput>> {
    logger.info("Recording action outcome", {
      actionId: input.actionId,
      wasSuccessful: input.wasSuccessful,
    });

    const updated = await this.actionRepo.recordOutcome(input.actionId, {
      wasSuccessful: input.wasSuccessful,
      notes: input.notes,
      ...(input.measuredImpact !== undefined ? { measuredImpact: input.measuredImpact } : {}),
    });

    if (!updated) {
      return toolFailure(
        "ACTION_NOT_FOUND",
        `Action ${input.actionId} not found`,
        0
      );
    }

    return toolSuccess(
      { operation: "record_action_outcome", success: true, timestamp: now.toISOString() },
      0
    );
  }

  private async handleUpdateActionStatus(
    input: Extract<ActionLogInput, { operation: "update_action_status" }>,
    now: Date
  ): Promise<ToolResult<ActionLogOutput>> {
    logger.info("Updating action status", {
      actionId: input.actionId,
      newStatus: input.newStatus,
    });

    const updated = await this.actionRepo.updateStatus(
      input.actionId,
      input.newStatus,
      input.notes
    );

    if (!updated) {
      return toolFailure(
        "ACTION_NOT_FOUND",
        `Action ${input.actionId} not found`,
        0
      );
    }

    return toolSuccess(
      { operation: "update_action_status", success: true, timestamp: now.toISOString() },
      0
    );
  }
}
