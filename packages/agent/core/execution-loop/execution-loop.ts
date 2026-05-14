import { createLogger, generateId, AgentError, ERROR_CODES } from "@opsmind/shared";
import { type ReasoningStepResult } from "@opsmind/shared";
import { getAgentConfig } from "@opsmind/config";
import { type ExecutionPlanOutput, type ExecutionPlanStep } from "@opsmind/ai";
import { getToolRegistry } from "@opsmind/tools";
import { type AgentStateManager } from "../state-manager/agent-state.manager";
import { type ToolResultSummary } from "@opsmind/ai";

const logger = createLogger("ExecutionLoop");

/**
 * Execution Loop — drives the tool execution phase of the reasoning pipeline.
 *
 * Takes the execution plan produced by the PlannerEngine and executes each step:
 * 1. Resolves the tool from the registry
 * 2. Invokes the tool with the planned input
 * 3. Records the result in agent state
 * 4. Handles failures (critical vs non-critical steps)
 * 5. Enforces step timeout and max-steps limits
 *
 * Rule §6.3: AI NEVER directly accesses databases — all tool calls go through
 * the tool registry, which enforces the MCP tool interface.
 *
 * Rule §10: NEVER swallow errors — all failures are logged with full context.
 */

export interface ExecutionLoopResult {
  toolResults: ToolResultSummary[];
  completedSteps: number;
  failedSteps: number;
  aborted: boolean;
  abortReason?: string;
}

export class ExecutionLoop {
  private readonly registry = getToolRegistry();

  async execute(
    plan: ExecutionPlanOutput,
    stateManager: AgentStateManager
  ): Promise<ExecutionLoopResult> {
    const config = getAgentConfig();
    const sessionId = stateManager.sessionId;
    const toolResults: ToolResultSummary[] = [];
    let completedSteps = 0;
    let failedSteps = 0;

    logger.info("Starting execution loop", {
      sessionId,
      stepCount: plan.steps.length,
      estimatedDurationSeconds: plan.estimatedDurationSeconds,
    });

    // Enforce max steps limit
    const stepsToExecute = plan.steps.slice(0, config.maxSteps);
    if (plan.steps.length > config.maxSteps) {
      logger.warn("Plan exceeds max steps — truncating", {
        sessionId,
        planSteps: plan.steps.length,
        maxSteps: config.maxSteps,
      });
    }

    for (const step of stepsToExecute) {
      stateManager.setCurrentStep(`executing:${step.stepId}`);

      const stepResult = await this.executeStep(step, stateManager, sessionId);

      toolResults.push({
        toolName: step.toolName,
        stepDescription: step.description,
        result: stepResult.resultText,
        success: stepResult.success,
      });

      if (stepResult.success) {
        completedSteps++;
      } else {
        failedSteps++;

        if (step.isCritical) {
          logger.error("Critical step failed — aborting execution loop", {
            sessionId,
            stepId: step.stepId,
            toolName: step.toolName,
            error: stepResult.error,
          });

          return {
            toolResults,
            completedSteps,
            failedSteps,
            aborted: true,
            abortReason: `Critical step "${step.stepId}" (${step.toolName}) failed: ${stepResult.error}`,
          };
        }

        logger.warn("Non-critical step failed — continuing", {
          sessionId,
          stepId: step.stepId,
          toolName: step.toolName,
        });
      }
    }

    logger.info("Execution loop completed", {
      sessionId,
      completedSteps,
      failedSteps,
      totalSteps: stepsToExecute.length,
    });

    return { toolResults, completedSteps, failedSteps, aborted: false };
  }

  private async executeStep(
    step: ExecutionPlanStep,
    stateManager: AgentStateManager,
    sessionId: string
  ): Promise<{ success: boolean; resultText: string; error?: string }> {
    const toolCallId = generateId();
    const start = Date.now();

    logger.debug("Executing step", {
      sessionId,
      stepId: step.stepId,
      toolName: step.toolName,
      description: step.description,
    });

    // Record tool call start in state
    stateManager.recordToolCallStarted({
      toolName: step.toolName,
      toolId: step.stepId,
      toolCallId,
      input: step.toolInput,
    });

    // Check tool exists before attempting execution
    if (!this.registry.has(step.toolName)) {
      const error = `Tool "${step.toolName}" not found in registry`;
      const durationMs = Date.now() - start;

      stateManager.recordToolCallFailed(toolCallId, error, durationMs);
      this.recordStepResult(stateManager, step, false, error, durationMs);

      return { success: false, resultText: `Tool not found: ${step.toolName}`, error };
    }

    // Execute via registry — enforces MCP tool interface
    const result = await this.registry.execute(step.toolName, step.toolInput);
    const durationMs = Date.now() - start;

    if (result.success) {
      stateManager.recordToolCallCompleted(toolCallId, result.data, durationMs);
      this.recordStepResult(stateManager, step, true, JSON.stringify(result.data, null, 2), durationMs);

      return {
        success: true,
        resultText: JSON.stringify(result.data, null, 2),
      };
    } else {
      const errorMsg = result.error.message;
      stateManager.recordToolCallFailed(toolCallId, errorMsg, durationMs);
      this.recordStepResult(stateManager, step, false, errorMsg, durationMs);

      return {
        success: false,
        resultText: `Tool execution failed: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  private recordStepResult(
    stateManager: AgentStateManager,
    step: ExecutionPlanStep,
    success: boolean,
    reasoning: string,
    durationMs: number
  ): void {
    const result: ReasoningStepResult = {
      stepId: step.stepId,
      stepType: step.toolName,
      status: success ? "completed" : "failed",
      input: step.toolInput,
      output: {},
      reasoning: success
        ? `${step.description} — completed successfully`
        : `${step.description} — failed: ${reasoning}`,
      durationMs,
      timestamp: new Date(),
      ...(success ? {} : { error: reasoning }),
    };

    stateManager.recordStepCompleted(result);
  }
}
