"use client";

import { useState, useCallback } from "react";
import { agentApi, type StartSessionResponse } from "@/services/api-client/agent.api";
import { ApiClientError } from "@/services/api-client/client";
import type { StartAgentRequest } from "@opsmind/shared";

/**
 * Hook for managing an agent investigation session.
 *
 * Calls POST /api/agent/sessions synchronously — waits for the full pipeline.
 * Rule §3.2: No business logic here — pure UI state management.
 */

export type SessionState =
  | { status: "idle" }
  | { status: "running"; currentStep: string }
  | { status: "completed"; result: StartSessionResponse }
  | { status: "error"; message: string };

export function useAgentSession() {
  const [state, setState] = useState<SessionState>({ status: "idle" });

  const startSession = useCallback(
    async (request: StartAgentRequest): Promise<StartSessionResponse | null> => {
      setState({ status: "running", currentStep: "Initializing investigation..." });

      try {
        const stepTimer = setInterval(() => {
          setState((prev) => {
            if (prev.status !== "running") return prev;
            return { status: "running", currentStep: getNextStepLabel(prev.currentStep) };
          });
        }, 8000);

        const result = await agentApi.startSessionSync(request);
        clearInterval(stepTimer);

        setState({ status: "completed", result });
        return result;
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Investigation failed unexpectedly";

        setState({ status: "error", message });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, startSession, reset };
}

const STEP_LABELS = [
  "Assembling operational context...",
  "Decomposing investigation goal...",
  "Building execution plan...",
  "Executing analysis tools...",
  "Synthesizing decision...",
  "Running reflection analysis...",
  "Persisting to organizational memory...",
];

function getNextStepLabel(current: string): string {
  const idx = STEP_LABELS.indexOf(current);
  if (idx === -1 || idx >= STEP_LABELS.length - 1) {
    return STEP_LABELS[Math.floor(Math.random() * STEP_LABELS.length)] ?? current;
  }
  return STEP_LABELS[idx + 1] ?? current;
}
