import { z } from "zod";
import { createLogger, generateId } from "@opsmind/shared";
import {
  OperationalStateRepository,
  SessionRepository,
  DecisionRepository,
} from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../../registry/tool.interface";

const logger = createLogger("UpdateMemoryTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const updateMemoryInputSchema = z.discriminatedUnion("operation", [
  /**
   * Update the current operational state — e.g., mark an anomaly as resolved,
   * update a metric value, or add a new investigation.
   */
  z.object({
    operation: z.literal("update_state"),
    sessionId: z.string(),
    updates: z.object({
      summary: z.string().optional(),
      resolveAnomalyId: z.string().optional(),
      addInvestigationId: z.string().optional(),
      removeInvestigationId: z.string().optional(),
      lastDecisionId: z.string().optional(),
    }),
  }),

  /**
   * Update a session's current step and progress.
   * Called at each pipeline step to track agent progress.
   */
  z.object({
    operation: z.literal("update_session_step"),
    sessionId: z.string(),
    currentStep: z.string(),
    stepResult: z.object({
      stepId: z.string(),
      stepType: z.string(),
      reasoning: z.string(),
      durationMs: z.number(),
    }),
  }),

  /**
   * Attach reflection output to a decision and finalize it.
   */
  z.object({
    operation: z.literal("finalize_decision"),
    decisionId: z.string(),
    reflection: z.object({
      confidenceAssessment: z.string(),
      reasoningQuality: z.string(),
      identifiedRisks: z.array(z.string()),
      alternativeApproaches: z.array(z.string()),
      limitations: z.array(z.string()),
      improvementSuggestions: z.array(z.string()),
      overallScore: z.number().min(0).max(1),
    }),
    finalConfidenceScore: z.number().min(0).max(1),
  }),
]);

type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const updateMemoryOutputSchema = z.object({
  operation: z.string(),
  success: z.boolean(),
  updatedAt: z.string(),
  details: z.record(z.unknown()),
});

type UpdateMemoryOutput = z.infer<typeof updateMemoryOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * UpdateMemoryTool — updates operational memory during agent execution.
 *
 * Used throughout the reasoning pipeline to keep MongoDB state synchronized
 * with the agent's current understanding. Supports three operations:
 * - update_state: modifies the current operational state snapshot
 * - update_session_step: tracks agent progress through the pipeline
 * - finalize_decision: attaches reflection and finalizes a decision
 */
export class UpdateMemoryTool extends BaseTool<UpdateMemoryInput, UpdateMemoryOutput> {
  readonly name = "update_memory";
  readonly description =
    "Updates operational memory during agent execution. " +
    "Use 'update_state' to reflect resolved anomalies or new investigations. " +
    "Use 'update_session_step' to track reasoning progress. " +
    "Use 'finalize_decision' to attach reflection and finalize a decision.";
  readonly category = "memory_write" as const;
  readonly inputSchema = updateMemoryInputSchema;
  readonly outputSchema = updateMemoryOutputSchema;

  private readonly stateRepo = new OperationalStateRepository();
  private readonly sessionRepo = new SessionRepository();
  private readonly decisionRepo = new DecisionRepository();

  protected async run(input: UpdateMemoryInput): Promise<ToolResult<UpdateMemoryOutput>> {
    const now = new Date();

    switch (input.operation) {
      case "update_state":
        return this.handleUpdateState(input, now);
      case "update_session_step":
        return this.handleUpdateSessionStep(input, now);
      case "finalize_decision":
        return this.handleFinalizeDecision(input, now);
    }
  }

  private async handleUpdateState(
    input: Extract<UpdateMemoryInput, { operation: "update_state" }>,
    now: Date
  ): Promise<ToolResult<UpdateMemoryOutput>> {
    logger.info("Updating operational state", { sessionId: input.sessionId });

    const current = await this.stateRepo.findCurrent();
    if (!current) {
      return toolFailure("STATE_NOT_FOUND", "No current operational state found", 0);
    }

    const stateUpdates: Record<string, unknown> = {};

    if (input.updates.summary) {
      stateUpdates["summary"] = input.updates.summary;
    }

    if (input.updates.lastDecisionId) {
      stateUpdates["lastDecisionId"] = input.updates.lastDecisionId;
    }

    // Resolve an anomaly by ID
    if (input.updates.resolveAnomalyId) {
      const updatedAnomalies = current.anomalies.map((a) =>
        a.id === input.updates.resolveAnomalyId
          ? { ...a, status: "resolved" as const, resolvedAt: now }
          : a
      );
      stateUpdates["anomalies"] = updatedAnomalies;
    }

    // Add a new active investigation
    if (input.updates.addInvestigationId) {
      const investigations = new Set(current.activeInvestigations);
      investigations.add(input.updates.addInvestigationId);
      stateUpdates["activeInvestigations"] = Array.from(investigations);
    }

    // Remove a completed investigation
    if (input.updates.removeInvestigationId) {
      stateUpdates["activeInvestigations"] = current.activeInvestigations.filter(
        (id) => id !== input.updates.removeInvestigationId
      );
    }

    await this.stateRepo.updateCurrentState(stateUpdates);

    return toolSuccess(
      {
        operation: "update_state",
        success: true,
        updatedAt: now.toISOString(),
        details: { updatedFields: Object.keys(stateUpdates) },
      },
      0
    );
  }

  private async handleUpdateSessionStep(
    input: Extract<UpdateMemoryInput, { operation: "update_session_step" }>,
    now: Date
  ): Promise<ToolResult<UpdateMemoryOutput>> {
    logger.debug("Updating session step", {
      sessionId: input.sessionId,
      step: input.currentStep,
    });

    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      return toolFailure(
        "SESSION_NOT_FOUND",
        `Session ${input.sessionId} not found`,
        0
      );
    }

    const stepResult = {
      stepId: input.stepResult.stepId,
      stepType: input.stepResult.stepType,
      status: "completed" as const,
      input: {},
      output: {},
      reasoning: input.stepResult.reasoning,
      durationMs: input.stepResult.durationMs,
      timestamp: now,
    };

    await this.sessionRepo.updateSession(input.sessionId, {
      currentStep: input.currentStep,
      stepCount: session.stepCount + 1,
      completedSteps: [...session.completedSteps, stepResult],
    });

    return toolSuccess(
      {
        operation: "update_session_step",
        success: true,
        updatedAt: now.toISOString(),
        details: {
          sessionId: input.sessionId,
          step: input.currentStep,
          totalSteps: session.stepCount + 1,
        },
      },
      0
    );
  }

  private async handleFinalizeDecision(
    input: Extract<UpdateMemoryInput, { operation: "finalize_decision" }>,
    now: Date
  ): Promise<ToolResult<UpdateMemoryOutput>> {
    logger.info("Finalizing decision with reflection", {
      decisionId: input.decisionId,
    });

    const updated = await this.decisionRepo.updateDecision(input.decisionId, {
      reflection: input.reflection,
      confidenceScore: input.finalConfidenceScore,
      status: "finalized",
      updatedAt: now,
    });

    if (!updated) {
      return toolFailure(
        "DECISION_NOT_FOUND",
        `Decision ${input.decisionId} not found`,
        0
      );
    }

    return toolSuccess(
      {
        operation: "finalize_decision",
        success: true,
        updatedAt: now.toISOString(),
        details: {
          decisionId: input.decisionId,
          finalConfidenceScore: input.finalConfidenceScore,
          status: "finalized",
        },
      },
      0
    );
  }
}
