/**
 * API contract types — shared between apps/api and apps/web.
 * Defines the standard response envelope and all request/response shapes.
 */

// ─── Standard API Response Envelope ──────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  durationMs?: number;
  pagination?: PaginationMeta;
}

/** Input type for response builders — allows undefined values that get filtered out */
export interface ResponseMetaInput {
  requestId?: string | undefined;
  durationMs?: number | undefined;
  pagination?: PaginationMeta | undefined;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Agent API ────────────────────────────────────────────────────────────────

export interface StartAgentRequest {
  goal: string;
  context?: {
    domain?: string;
    timeframe?: string;
    metrics?: string[];
  };
}

export interface StartAgentResponse {
  sessionId: string;
  status: string;
  estimatedDurationMs?: number;
}

export interface AgentStatusResponse {
  sessionId: string;
  status: string;
  currentStep: string;
  stepCount: number;
  progress: number; // 0–100
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  decisionId?: string;
  goal?: string;
  confidenceScore?: number;
  error?: {
    code: string;
    message: string;
  };
}

// ─── Decision API ─────────────────────────────────────────────────────────────

export interface DecisionListResponse {
  decisions: DecisionSummary[];
  pagination: PaginationMeta;
}

export interface DecisionSummary {
  id: string;
  sessionId: string;
  goal: string;
  category: string;
  status: string;
  confidenceLevel: string;
  confidenceScore: number;
  summary: string;
  recommendationCount: number;
  createdAt: string;
  searchScore?: number;
  searchType?: "text" | "vector" | "hybrid";
  highlightText?: string;
}

export interface DecisionDetailResponse {
  decision: import("./decision").Decision;
}

// ─── Actions API ──────────────────────────────────────────────────────────────

export interface ActionListResponse {
  actions: import("./decision").ActionRecommendation[];
  pagination: PaginationMeta;
}

export interface UpdateActionStatusRequest {
  status: import("./decision").ActionStatus;
  notes?: string;
}

// ─── Dashboard API ────────────────────────────────────────────────────────────

export interface DashboardStateResponse {
  operationalState: import("./memory").OperationalState;
  recentDecisions: DecisionSummary[];
  activeAnomalies: import("./memory").DetectedAnomaly[];
  pendingActions: import("./decision").ActionRecommendation[];
  systemHealth: SystemHealth;
  insights?: {
    remediationSuccessRate: number;
    totalRemediations: number;
    priorityDistribution: Record<string, number>;
  };
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  agentStatus: string;
  memoryStatus: string;
  lastActivityAt: string;
}
