import { createLogger, generateSessionId } from "@opsmind/shared";
import { type AgentState, type AgentGoal, type ToolCall, type ReasoningStepResult } from "@opsmind/shared";
import { type GoalDecompositionOutput } from "@opsmind/ai";
import { type ExecutionPlanStep } from "@opsmind/ai";

const logger = createLogger("AgentStateManager");

/**
 * Agent State Manager — maintains in-memory agent state during execution.
 *
 * This is the single source of truth for what the agent is doing RIGHT NOW.
 * It tracks:
 * - Current pipeline step
 * - Completed reasoning steps with results
 * - Tool calls made and their outcomes
 * - Memory context assembled for this session
 * - Iteration count and completion status
 *
 * State is held in memory during execution and persisted to MongoDB
 * at key checkpoints via the MemoryWriter.
 *
 * One StateManager instance per agent session — never shared across sessions.
 */
export class AgentStateManager {
  private state: AgentState;

  constructor(
    goal: string,
    context: AgentGoal["context"],
    /** Optional pre-generated sessionId — used by async session flow */
    presetSessionId?: string
  ) {
    const sessionId = presetSessionId ?? generateSessionId();

    this.state = {
      sessionId,
      goal: {
        id: sessionId,
        raw: goal,
        category: "business_analysis", // updated after decomposition
        decomposedSteps: [],
        priority: "medium",
        context,
      },
      currentStep: "initializing",
      completedSteps: [],
      pendingSteps: [],
      toolCalls: [],
      memoryContext: {
        relevantDecisions: [],
        historicalPatterns: [],
        previousOutcomes: [],
        operationalState: {},
      },
      iterationCount: 0,
      isComplete: false,
    };

    logger.debug("Agent state initialized", { sessionId });
  }

  get sessionId(): string {
    return this.state.sessionId;
  }

  get currentState(): Readonly<AgentState> {
    return this.state;
  }

  get isComplete(): boolean {
    return this.state.isComplete;
  }

  // ─── Step Tracking ──────────────────────────────────────────────────────────

  setCurrentStep(step: string): void {
    logger.debug("Step transition", {
      sessionId: this.state.sessionId,
      from: this.state.currentStep,
      to: step,
    });
    this.state = { ...this.state, currentStep: step };
  }

  recordStepCompleted(result: ReasoningStepResult): void {
    this.state = {
      ...this.state,
      completedSteps: [...this.state.completedSteps, result],
      iterationCount: this.state.iterationCount + 1,
    };
  }

  setPendingSteps(steps: string[]): void {
    this.state = { ...this.state, pendingSteps: steps };
  }

  // ─── Goal ───────────────────────────────────────────────────────────────────

  updateGoalFromDecomposition(decomposition: GoalDecompositionOutput): void {
    this.state = {
      ...this.state,
      goal: {
        ...this.state.goal,
        category: decomposition.category,
        decomposedSteps: decomposition.reasoningSteps.map(
          (s: GoalDecompositionOutput["reasoningSteps"][number]) => s.description
        ),
        priority: decomposition.priority,
      },
    };
  }

  setPlanSteps(steps: ExecutionPlanStep[]): void {
    this.state = {
      ...this.state,
      pendingSteps: steps.map((s: ExecutionPlanStep) => s.stepId),
    };
  }

  // ─── Tool Calls ─────────────────────────────────────────────────────────────

  recordToolCallStarted(call: Omit<ToolCall, "status" | "output" | "durationMs" | "error">): void {
    const toolCall: ToolCall = { ...call, status: "pending" };
    this.state = {
      ...this.state,
      toolCalls: [...this.state.toolCalls, toolCall],
    };
  }

  recordToolCallCompleted(
    toolCallId: string,
    output: Record<string, unknown>,
    durationMs: number
  ): void {
    this.state = {
      ...this.state,
      toolCalls: this.state.toolCalls.map((tc: ToolCall) =>
        tc.toolCallId === toolCallId
          ? { ...tc, status: "success" as const, output, durationMs }
          : tc
      ),
    };
  }

  recordToolCallFailed(toolCallId: string, error: string, durationMs: number): void {
    this.state = {
      ...this.state,
      toolCalls: this.state.toolCalls.map((tc: ToolCall) =>
        tc.toolCallId === toolCallId
          ? { ...tc, status: "failed" as const, error, durationMs }
          : tc
      ),
    };
  }

  // ─── Memory Context ─────────────────────────────────────────────────────────

  setMemoryContext(context: AgentState["memoryContext"]): void {
    this.state = { ...this.state, memoryContext: context };
  }

  // ─── Completion ─────────────────────────────────────────────────────────────

  markComplete(): void {
    this.state = {
      ...this.state,
      isComplete: true,
      currentStep: "completed",
    };
  }

  markFailed(step: string): void {
    this.state = {
      ...this.state,
      isComplete: true,
      currentStep: `failed:${step}`,
    };
  }

  // ─── Computed Properties ────────────────────────────────────────────────────

  get progress(): number {
    const total = this.state.completedSteps.length + this.state.pendingSteps.length;
    if (total === 0) return 0;
    return Math.round((this.state.completedSteps.length / total) * 100);
  }

  get toolsUsed(): string[] {
    return [...new Set(this.state.toolCalls.map((tc: ToolCall) => tc.toolName))];
  }

  getCompletedStepsSummary(): Array<{ step: string; summary: string; durationMs: number }> {
    return this.state.completedSteps.map((s: ReasoningStepResult) => ({
      step: s.stepType,
      summary: s.reasoning,
      durationMs: s.durationMs,
    }));
  }
}
