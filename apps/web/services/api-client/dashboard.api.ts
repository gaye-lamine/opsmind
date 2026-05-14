import { apiClient } from "./client";
import type { DashboardStateResponse } from "@opsmind/shared";

/**
 * Dashboard API — typed method for dashboard state retrieval.
 */

export const dashboardApi = {
  getState: () =>
    apiClient.get<DashboardStateResponse>("/dashboard"),
};
