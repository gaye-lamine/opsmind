/**
 * @opsmind/shared
 *
 * Shared types, DTOs, validators, constants, and utilities.
 * This package has NO business logic — only contracts and helpers.
 *
 * Dependency rule: this package imports NOTHING from other @opsmind/* packages.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AgentSession,
  AgentSessionStatus,
  AgentGoal,
  AgentState,
  GoalCategory,
  BusinessContext,
  MemoryContext,
  ReasoningStepResult,
  ReasoningStepStatus,
  ToolCall,
  ToolCategory,
  ToolManifest,
} from "../types/agent";

export type {
  Decision,
  DecisionStatus,
  DecisionCategory,
  ConfidenceLevel,
  Finding,
  FindingSeverity,
  ActionRecommendation,
  ActionPriority,
  ActionStatus,
  DecisionReflection,
  ReasoningTrace,
  ReasoningTraceStep,
} from "../types/decision";

export type {
  Playbook,
  PlaybookStep,
} from "../types/playbook";

export type {
  OperationalState,
  BusinessMetric,
  DetectedAnomaly,
  AnomalySeverity,
  AnomalyStatus,
  ExecutionLog,
  LogLevel,
  MemoryEntry,
  HistoricalPattern,
  PatternOutcome,
} from "../types/memory";

export type {
  ApiResponse,
  ApiError,
  ResponseMeta,
  ResponseMetaInput,
  PaginationMeta,
  StartAgentRequest,
  StartAgentResponse,
  AgentStatusResponse,
  DecisionListResponse,
  DecisionSummary,
  DecisionDetailResponse,
  ActionListResponse,
  UpdateActionStatusRequest,
  DashboardStateResponse,
  SystemHealth,
} from "../types/api";

// ─── DTOs ─────────────────────────────────────────────────────────────────────
export {
  createDecisionSchema,
  updateActionStatusSchema,
  decisionQuerySchema,
  type CreateDecisionDto,
  type UpdateActionStatusDto,
  type DecisionQueryDto,
} from "../dto/decision.dto";

export {
  startAgentSessionSchema,
  agentSessionQuerySchema,
  type StartAgentSessionDto,
  type AgentSessionQueryDto,
} from "../dto/agent.dto";

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  AGENT_CONSTANTS,
  PIPELINE_STEPS,
  DECISION_CONSTANTS,
  API_CONSTANTS,
  ERROR_CODES,
  AGENT_EVENTS,
  type PipelineStep,
  type ErrorCode,
} from "../constants/index";

// ─── Validators ───────────────────────────────────────────────────────────────
export {
  validate,
  validateOrThrow,
  OpsMindError,
  ValidationError,
  AgentError,
  MemoryError,
  AIError,
  ToolError,
  type ValidationOutcome,
  type ValidationResult,
  type ValidationFailure,
} from "../validators/index";

// ─── Utils ────────────────────────────────────────────────────────────────────
export {
  generateId,
  generateSessionId,
  generateDecisionId,
  generateActionId,
  generateFindingId,
  generateLogId,
} from "../utils/id";

export {
  scoreToConfidenceLevel,
  isConfidenceAcceptable,
  clampConfidence,
} from "../utils/confidence";

export {
  Logger,
  SessionLogger,
  createLogger,
  type LogEntry,
} from "../utils/logger";

export {
  successResponse,
  errorResponse,
  paginatedResponse,
  buildPagination,
} from "../utils/response";

export {
  withTimeout,
} from "../utils/promise";
