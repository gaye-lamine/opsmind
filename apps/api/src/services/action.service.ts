import { createLogger, ERROR_CODES, MemoryError } from "@opsmind/shared";
import { type ActionStatus } from "@opsmind/shared";
import { ActionRepository } from "@opsmind/memory";
import {
  updateActionStatus,
  recordActionOutcome,
} from "@opsmind/agent";
import { type ActionDocument } from "@opsmind/memory";

const logger = createLogger("ActionService");

/**
 * Action Service — manages action recommendation lifecycle.
 *
 * Rule §3.2: apps/api NEVER queries MongoDB directly.
 * Read operations use ActionRepository from @opsmind/memory.
 * Write operations delegate to @opsmind/agent workflows.
 */
export class ActionService {
  private readonly actionRepo = new ActionRepository();

  /**
   * Returns all pending actions — used for the dashboard actions panel.
   */
  async getPendingActions(): Promise<ActionDocument[]> {
    return this.actionRepo.findPending();
  }

  /**
   * Returns all actions for a specific decision.
   */
  async getActionsByDecision(decisionId: string): Promise<ActionDocument[]> {
    return this.actionRepo.findByDecisionId(decisionId);
  }

  /**
   * Updates the status of an action recommendation.
   * Delegates to the action execution workflow for audit trail.
   */
  async updateStatus(
    actionId: string,
    newStatus: ActionStatus,
    notes?: string
  ): Promise<void> {
    logger.info("Updating action status", { actionId, newStatus });

    // Verify action exists first
    const action = await this.actionRepo.findById(actionId);
    if (!action) {
      throw new MemoryError(
        `Action ${actionId} not found`,
        ERROR_CODES.DECISION_NOT_FOUND,
        { actionId }
      );
    }

    const result = await updateActionStatus({
      actionId,
      newStatus: newStatus as "acknowledged" | "in_progress" | "completed" | "dismissed",
      notes,
    });

    if (!result.success) {
      throw new MemoryError(
        result.error ?? "Failed to update action status",
        ERROR_CODES.MEMORY_WRITE_FAILED,
        { actionId }
      );
    }
  }

  /**
   * Records the outcome of a completed action.
   * This closes the feedback loop — future reasoning learns from this.
   */
  async recordOutcome(
    actionId: string,
    wasSuccessful: boolean,
    notes: string,
    measuredImpact?: string
  ): Promise<void> {
    logger.info("Recording action outcome", { actionId, wasSuccessful });

    const action = await this.actionRepo.findById(actionId);
    if (!action) {
      throw new MemoryError(
        `Action ${actionId} not found`,
        ERROR_CODES.DECISION_NOT_FOUND,
        { actionId }
      );
    }

    const result = await recordActionOutcome({
      actionId,
      wasSuccessful,
      notes,
      measuredImpact,
    });

    if (!result.success) {
      throw new MemoryError(
        result.error ?? "Failed to record action outcome",
        ERROR_CODES.MEMORY_WRITE_FAILED,
        { actionId }
      );
    }
  }
}
