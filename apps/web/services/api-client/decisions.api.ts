import { apiClient } from "./client";
import type { Decision, DecisionSummary, PaginationMeta } from "@opsmind/shared";

/**
 * Decisions API — typed methods for decision retrieval.
 */

export interface DecisionListData {
  decisions: DecisionSummary[];
  pagination: PaginationMeta;
}

export interface DecisionDetailData {
  decision: Decision;
}

export interface ExecutedAction {
  actionType: string;
  system: string;
  status: string;
  message: string;
  details: Record<string, unknown>;
  executedAt: string;
}

export interface ExecutedActionsData {
  actions: ExecutedAction[];
  total: number;
}

export const decisionsApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    category?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.category) query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return apiClient.get<DecisionListData>(`/decisions${qs ? `?${qs}` : ""}`);
  },

  getById: (id: string) =>
    apiClient.get<DecisionDetailData>(`/decisions/${id}`),

  getExecutedActions: (id: string) =>
    apiClient.get<ExecutedActionsData>(`/decisions/${id}/executed-actions`),
};
