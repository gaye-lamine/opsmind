"use client";

import { useState, useEffect, useCallback } from "react";
import { decisionsApi, type DecisionListData } from "@/services/api-client/decisions.api";

/**
 * Hook for paginated decision list with filtering.
 */

interface UseDecisionsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  status?: string;
}

interface UseDecisionsResult {
  data: DecisionListData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDecisions(params: UseDecisionsParams = {}): UseDecisionsResult {
  const [data, setData] = useState<DecisionListData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await decisionsApi.list(params);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setIsLoading(false);
    }
  }, [params.page, params.pageSize, params.category, params.status]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, isLoading, error, refresh: fetch };
}
