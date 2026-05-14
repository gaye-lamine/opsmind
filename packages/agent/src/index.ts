/**
 * @opsmind/agent
 *
 * Autonomous runtime layer for OpsMind.
 *
 * This package is the top of the dependency chain — it imports from all
 * other packages and coordinates the full reasoning pipeline.
 *
 * Dependency chain:
 *   agent → ai + tools + memory → shared + config
 *
 * Public API (what apps/api uses):
 * - AgentRuntime.getInstance() — singleton runtime
 * - runtime.bootstrap() — initialize all dependencies
 * - runtime.runSession(input) — execute a full reasoning pipeline
 * - runtime.getSessionStatus(id) — check session progress
 * - Workflow functions — specialized entry points per use case
 *
 * Internal (not exported — used only within this package):
 * - Orchestrator — pipeline coordinator
 * - ExecutionLoop — tool execution
 * - AgentStateManager — in-memory state
 */

// ─── Runtime (primary public API) ────────────────────────────────────────────
export {
  AgentRuntime,
  getAgentRuntime,
} from "../core/runtime/agent-runtime";

// ─── SSE Event Store (for real-time pipeline streaming) ──────────────────────
export {
  SseEventStore,
  getSseEventStore,
} from "../core/sse-event-store";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  StartSessionInput,
  StartSessionOutput,
  SessionStatusOutput,
  AgentRunResult,
  AgentRunSuccess,
  AgentRunFailure,
  PipelineStepEvent,
} from "../interfaces/agent.interfaces";

// ─── Workflows ────────────────────────────────────────────────────────────────
export {
  runBusinessAnalysis,
  type BusinessAnalysisInput,
} from "../workflows/business-analysis/business-analysis.workflow";

export {
  runAnomalyInvestigation,
  type AnomalyInvestigationInput,
} from "../workflows/monitoring/anomaly-investigation.workflow";

export {
  runStrategicPlanning,
  type StrategicPlanningInput,
} from "../workflows/planning/strategic-planning.workflow";

export {
  updateActionStatus,
  recordActionOutcome,
  type UpdateActionInput,
  type RecordOutcomeInput,
} from "../workflows/execution/action-execution.workflow";

// ─── Monitoring ───────────────────────────────────────────────────────────────
export {
  MonitoringLoop,
  getMonitoringLoop,
  type MonitoringCheckResult,
} from "../workflows/monitoring/monitoring-loop";
