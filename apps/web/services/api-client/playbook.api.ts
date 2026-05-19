import { apiClient } from "./client";
import type { Playbook } from "@opsmind/shared";

export const playbookApi = {
  getOrCreate: (decisionId: string) =>
    apiClient.get<Playbook>(`/decisions/${decisionId}/playbook`),

  executeStep: (decisionId: string, stepId: string) =>
    apiClient.post<Playbook>(`/decisions/${decisionId}/playbook/steps/${stepId}/execute`, {}),

  toggleStep: (decisionId: string, stepId: string, status: "pending" | "completed" | "skipped") =>
    apiClient.post<Playbook>(`/decisions/${decisionId}/playbook/steps/${stepId}/toggle`, { status }),
};
export type { Playbook };
