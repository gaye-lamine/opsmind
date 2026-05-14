import { apiClient } from "./client";
import type {
  StartAgentRequest,
  AgentStatusResponse,
} from "@opsmind/shared";

/**
 * Agent API — typed methods for agent session management.
 */

/**
 * Response from POST /api/agent/sessions (asynchronous).
 * Returns immediately with a sessionId.
 */
export interface AsyncStartResponse {
  sessionId: string;
  status: string;
}

/**
 * Response from POST /api/agent/sessions/sync (synchronous).
 * The pipeline runs to completion before this is returned.
 */
export interface StartSessionResponse {
  sessionId: string;
  decisionId: string;
  status: string;
  summary: string;
  confidenceScore: number;
  confidenceLevel: string;
  findingsCount: number;
  recommendationsCount: number;
  durationMs: number;
}

export interface SessionListResponse {
  sessions: AgentStatusResponse[];
  total: number;
}

export const agentApi = {
  /**
   * Starts an investigation session asynchronously.
   * Returns immediately with a sessionId.
   * Use SSE stream for real-time progress.
   */
  startSession: (body: StartAgentRequest) =>
    apiClient.post<AsyncStartResponse>("/agent/sessions", body),

  /**
   * Starts an investigation session and waits for completion.
   * Returns the full result including decisionId.
   */
  startSessionSync: (body: StartAgentRequest) =>
    apiClient.post<StartSessionResponse>("/agent/sessions/sync", body),

  getSessionStatus: (sessionId: string) =>
    apiClient.get<AgentStatusResponse>(`/agent/sessions/${sessionId}`),

  listSessions: (pageSize = 20) =>
    apiClient.get<SessionListResponse>(`/agent/sessions?pageSize=${pageSize}`),

  getActiveSessions: () =>
    apiClient.get<SessionListResponse>("/agent/sessions/active"),
};
