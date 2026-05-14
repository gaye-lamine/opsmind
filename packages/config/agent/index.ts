import { getEnv } from "../env/loader";

export interface AgentConfig {
  maxSteps: number;
  reflectionEnabled: boolean;
  confidenceThreshold: number;
  memoryRetrievalLimit: number;
  stepTimeoutMs: number;
  totalTimeoutMs: number;
}

/**
 * Agent runtime configuration.
 * Controls reasoning depth, reflection behavior, and memory retrieval.
 */
export function getAgentConfig(): AgentConfig {
  const env = getEnv();

  return {
    maxSteps: env.AGENT_MAX_STEPS,
    reflectionEnabled: env.AGENT_REFLECTION_ENABLED,
    confidenceThreshold: env.AGENT_CONFIDENCE_THRESHOLD,
    memoryRetrievalLimit: env.AGENT_MEMORY_RETRIEVAL_LIMIT,
    stepTimeoutMs: 30_000,
    totalTimeoutMs: 300_000,  // 5 minutes — gemini-2.5-pro can take 60-90s per call
  };
}

/**
 * Reasoning pipeline step identifiers.
 * Used for logging, state tracking, and execution flow control.
 */
export const REASONING_STEPS = {
  CONTEXT_ASSEMBLY: "context_assembly",
  GOAL_DECOMPOSITION: "goal_decomposition",
  PLANNING: "planning",
  TOOL_SELECTION: "tool_selection",
  EXECUTION: "execution",
  REFLECTION: "reflection",
  DECISION_SYNTHESIS: "decision_synthesis",
  MEMORY_PERSISTENCE: "memory_persistence",
} as const;

export type ReasoningStep =
  (typeof REASONING_STEPS)[keyof typeof REASONING_STEPS];
