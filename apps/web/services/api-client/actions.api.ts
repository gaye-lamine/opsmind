import { apiClient } from "./client";
import type { ActionRecommendation } from "@opsmind/shared";

/**
 * Actions API — typed methods for action lifecycle management.
 */

export interface ActionListData {
  actions: ActionRecommendation[];
  total: number;
}

export interface UpdateStatusBody {
  status: "acknowledged" | "in_progress" | "completed" | "dismissed";
  notes?: string;
}

export interface RecordOutcomeBody {
  wasSuccessful: boolean;
  notes: string;
  measuredImpact?: string;
}

export const actionsApi = {
  getPending: () =>
    apiClient.get<ActionListData>("/actions/pending"),

  getByDecision: (decisionId: string) =>
    apiClient.get<ActionListData>(`/actions/decision/${decisionId}`),

  updateStatus: (actionId: string, body: UpdateStatusBody) =>
    apiClient.patch<{ actionId: string; status: string; updatedAt: string }>(
      `/actions/${actionId}/status`,
      body
    ),

  recordOutcome: (actionId: string, body: RecordOutcomeBody) =>
    apiClient.post<{ actionId: string; outcomeRecorded: boolean }>(
      `/actions/${actionId}/outcome`,
      body
    ),
};
