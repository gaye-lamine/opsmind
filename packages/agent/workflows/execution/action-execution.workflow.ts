import { createLogger } from "@opsmind/shared";
import { getToolRegistry } from "@opsmind/tools";
import { type AgentRunResult } from "../../interfaces/agent.interfaces";

const logger = createLogger("ActionExecutionWorkflow");

/**
 * Action Execution Workflow — handles post-decision action tracking.
 *
 * This workflow manages the lifecycle of action recommendations after
 * a decision has been made:
 * - Acknowledging actions
 * - Marking actions in progress
 * - Recording action outcomes (closes the feedback loop)
 * - Dismissing irrelevant actions
 *
 * This is NOT a reasoning workflow — it does not invoke Gemini.
 * It directly updates MongoDB via the action_log tool.
 */

export interface UpdateActionInput {
  actionId: string;
  newStatus: "acknowledged" | "in_progress" | "completed" | "dismissed";
  notes?: string;
}

export interface RecordOutcomeInput {
  actionId: string;
  wasSuccessful: boolean;
  notes: string;
  measuredImpact?: string;
}

export async function updateActionStatus(
  input: UpdateActionInput
): Promise<{ success: boolean; error?: string }> {
  logger.info("Updating action status", {
    actionId: input.actionId,
    newStatus: input.newStatus,
  });

  const registry = getToolRegistry();

  const result = await registry.execute("action_log", {
    operation: "update_action_status",
    actionId: input.actionId,
    newStatus: input.newStatus,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
}

export async function recordActionOutcome(
  input: RecordOutcomeInput
): Promise<{ success: boolean; error?: string }> {
  logger.info("Recording action outcome", {
    actionId: input.actionId,
    wasSuccessful: input.wasSuccessful,
  });

  const registry = getToolRegistry();

  const result = await registry.execute("action_log", {
    operation: "record_action_outcome",
    actionId: input.actionId,
    wasSuccessful: input.wasSuccessful,
    notes: input.notes,
    ...(input.measuredImpact !== undefined ? { measuredImpact: input.measuredImpact } : {}),
  });

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
}
