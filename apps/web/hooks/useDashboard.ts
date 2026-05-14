"use client";

import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "@/services/api-client/dashboard.api";
import type { DashboardStateResponse } from "@opsmind/shared";

/**
 * Hook for dashboard state with auto-refresh.
 *
 * Polls the dashboard API every 30 seconds to keep the operational
 * state current without requiring a full page reload.
 */

interface UseDashboardResult {
  data: DashboardStateResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(autoRefreshMs = 30_000): UseDashboardResult {
  const [data, setData] = useState<DashboardStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await dashboardApi.getState();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();

    if (autoRefreshMs > 0) {
      const interval = setInterval(() => void fetch(), autoRefreshMs);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [fetch, autoRefreshMs]);

  return { data, isLoading, error, refresh: fetch };
}
