import { type Decision, type AgentSession } from "@opsmind/shared";

/**
 * Agent public interfaces — the contracts exposed to apps/api.
 *
 * apps/api ONLY interacts with the agent through these interfaces.
 * It never imports from core/ or workflows/ directly.
 */

// ─── Session Start ────────────────────────────────────────────────────────────

export interface StartSessionInput {
  goal: string;
  context?: {
    domain?: string;
    timeframe?: string;
    metrics?: string[];
  };
}

export interface StartSessionOutput {
  sessionId: string;
  status: AgentSession["status"];
  startedAt: Date;
}

// ─── Session Status ───────────────────────────────────────────────────────────

export interface SessionStatusOutput {
  sessionId: string;
  status: AgentSession["status"];
  currentStep: string;
  stepCount: number;
  progress: number; // 0–100
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  decisionId?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ─── Agent Run Result ─────────────────────────────────────────────────────────

export type AgentRunResult = AgentRunSuccess | AgentRunFailure;

export interface AgentRunSuccess {
  success: true;
  sessionId: string;
  decision: Decision;
  durationMs: number;
  stepCount: number;
}

export interface AgentRunFailure {
  success: false;
  sessionId: string;
  error: {
    code: string;
    message: string;
    step?: string;
  };
  durationMs: number;
}

// ─── Pipeline Step Event (for streaming/SSE) ──────────────────────────────────

export type PipelineStepEvent =
  | { type: "step_started"; step: string; sessionId: string; timestamp: Date }
  | { type: "step_completed"; step: string; sessionId: string; durationMs: number; timestamp: Date }
  | { type: "tool_called"; toolName: string; sessionId: string; timestamp: Date }
  | { type: "tool_result"; toolName: string; success: boolean; sessionId: string; timestamp: Date }
  | { type: "decision_generated"; decisionId: string; sessionId: string; timestamp: Date }
  | { type: "reflection_completed"; assessment: string; confidenceDelta: number; sessionId: string; timestamp: Date }
  | { type: "session_completed"; decisionId: string; sessionId: string; durationMs: number; timestamp: Date }
  | { type: "session_failed"; error: string; sessionId: string; timestamp: Date };
