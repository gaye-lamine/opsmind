/**
 * System-wide constants for OpsMind.
 * Single source of truth for all magic values.
 */

// ─── Agent ────────────────────────────────────────────────────────────────────

export const AGENT_CONSTANTS = {
  DEFAULT_MAX_STEPS: 10,
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_MEMORY_RETRIEVAL_LIMIT: 5,
  MIN_CONFIDENCE_FOR_DECISION: 0.5,
  REFLECTION_CONFIDENCE_BOOST: 0.05,
  STEP_TIMEOUT_MS: 30_000,
  TOTAL_TIMEOUT_MS: 300_000,
} as const;

// ─── Reasoning Pipeline ───────────────────────────────────────────────────────

export const PIPELINE_STEPS = [
  "context_assembly",
  "goal_decomposition",
  "planning",
  "tool_selection",
  "execution",
  "reflection",
  "decision_synthesis",
  "memory_persistence",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

// ─── Decision ─────────────────────────────────────────────────────────────────

export const DECISION_CONSTANTS = {
  CONFIDENCE_LEVELS: {
    LOW: { min: 0, max: 0.4, label: "low" },
    MEDIUM: { min: 0.4, max: 0.65, label: "medium" },
    HIGH: { min: 0.65, max: 0.85, label: "high" },
    VERY_HIGH: { min: 0.85, max: 1, label: "very_high" },
  },
} as const;

// ─── API ──────────────────────────────────────────────────────────────────────

export const API_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  REQUEST_TIMEOUT_MS: 30_000,
} as const;

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Agent
  AGENT_TIMEOUT: "AGENT_TIMEOUT",
  AGENT_MAX_STEPS_EXCEEDED: "AGENT_MAX_STEPS_EXCEEDED",
  AGENT_REASONING_FAILED: "AGENT_REASONING_FAILED",
  AGENT_SESSION_NOT_FOUND: "AGENT_SESSION_NOT_FOUND",

  // Memory
  MEMORY_READ_FAILED: "MEMORY_READ_FAILED",
  MEMORY_WRITE_FAILED: "MEMORY_WRITE_FAILED",
  DECISION_NOT_FOUND: "DECISION_NOT_FOUND",

  // AI
  AI_GENERATION_FAILED: "AI_GENERATION_FAILED",
  AI_SCHEMA_VALIDATION_FAILED: "AI_SCHEMA_VALIDATION_FAILED",
  AI_RATE_LIMITED: "AI_RATE_LIMITED",

  // Tools
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",

  // System
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Events ───────────────────────────────────────────────────────────────────

export const AGENT_EVENTS = {
  SESSION_STARTED: "agent:session:started",
  STEP_COMPLETED: "agent:step:completed",
  DECISION_GENERATED: "agent:decision:generated",
  REFLECTION_COMPLETED: "agent:reflection:completed",
  SESSION_COMPLETED: "agent:session:completed",
  SESSION_FAILED: "agent:session:failed",
} as const;

export type AgentEvent = (typeof AGENT_EVENTS)[keyof typeof AGENT_EVENTS];
