/**
 * Core agent domain types.
 * These are the fundamental data structures that flow through the entire system.
 */

// ─── Agent Session ────────────────────────────────────────────────────────────

export type AgentSessionStatus =
  | "initializing"
  | "running"
  | "reflecting"
  | "completed"
  | "failed"
  | "timeout";

export interface AgentSession {
  id: string;
  goal: string;
  status: AgentSessionStatus;
  currentStep: string;
  stepCount: number;
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

// ─── Reasoning Step ───────────────────────────────────────────────────────────

export type ReasoningStepStatus = "pending" | "running" | "completed" | "failed";

export interface ReasoningStepResult {
  stepId: string;
  stepType: string;
  status: ReasoningStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;
  durationMs: number;
  timestamp: Date;
  error?: string;
}

// ─── Agent Goal ───────────────────────────────────────────────────────────────

export type GoalCategory =
  | "anomaly_investigation"
  | "business_analysis"
  | "strategic_planning"
  | "operational_monitoring"
  | "risk_assessment"
  | "performance_review";

export interface AgentGoal {
  id: string;
  raw: string;
  category: GoalCategory;
  decomposedSteps: string[];
  priority: "low" | "medium" | "high" | "critical";
  context: BusinessContext;
}

// ─── Business Context ─────────────────────────────────────────────────────────

export interface BusinessContext {
  domain?: string;
  timeframe?: string;
  metrics?: string[];
  relatedEntities?: string[];
  historicalContext?: string;
}

// ─── Tool Call ────────────────────────────────────────────────────────────────

export interface ToolCall {
  toolName: string;
  toolId: string;
  /** Unique identifier for this specific invocation — used for result matching */
  toolCallId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "success" | "failed";
  durationMs?: number;
  error?: string;
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export interface AgentState {
  sessionId: string;
  goal: AgentGoal;
  currentStep: string;
  completedSteps: ReasoningStepResult[];
  pendingSteps: string[];
  toolCalls: ToolCall[];
  memoryContext: MemoryContext;
  iterationCount: number;
  isComplete: boolean;
}

// ─── Memory Context ───────────────────────────────────────────────────────────

export interface MemoryContext {
  relevantDecisions: string[];
  historicalPatterns: string[];
  previousOutcomes: string[];
  operationalState: Record<string, unknown>;
}
