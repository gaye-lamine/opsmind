"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { agentApi } from "@/services/api-client/agent.api";
import { LivePipelineView, type PipelineStepState } from "@/components/agent/LivePipelineView";
import { cn } from "@/lib/utils";

const EXAMPLE_GOALS = [
  "Customer acquisition costs increased 37% this week — investigate root cause",
  "Revenue dropped 18% vs. last month — analyze contributing factors",
  "What operational risks should we prioritize this quarter?",
  "Churn rate is trending upward — identify and quantify drivers",
];

const PIPELINE_STEPS: { id: string; label: string; icon: string }[] = [
  { id: "context_assembly", label: "Context", icon: "📡" },
  { id: "goal_decomposition", label: "Decompose", icon: "🔬" },
  { id: "planning", label: "Plan", icon: "📋" },
  { id: "execution", label: "Execute", icon: "⚡" },
  { id: "decision_synthesis", label: "Synthesize", icon: "🧠" },
  { id: "reflection", label: "Reflect", icon: "🪞" },
  { id: "memory_persistence", label: "Persist", icon: "💾" },
];

/**
 * Investigation Launcher — the primary interaction point for starting agent sessions.
 *
 * Calls POST /api/agent/sessions (async) — returns sessionId immediately,
 * then opens an SSE stream to show real-time progress.
 *
 * Rule §8: This is NOT a chat interface. It is an investigation launcher.
 */
export function InvestigationLauncher() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStepState[]>(
    PIPELINE_STEPS.map((s) => ({ ...s, status: "pending" as const }))
  );

  const connectSseStream = (sessionId: string, currentGoal: string) => {
    setIsRunning(true);
    setError(null);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
    const eventSource = new EventSource(`${baseUrl}/agent/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "session_not_found") {
        eventSource.close();
        setIsRunning(false);
        localStorage.removeItem("active_investigation_session_id");
        localStorage.removeItem("active_investigation_goal");
        localStorage.removeItem("active_investigation_steps");
        return;
      }

      // Handle major pipeline steps
      if (data.type === "step_started") {
        setSteps((prev) => {
          const next = prev.map((s) => (s.id === data.step ? { ...s, status: "active" as const } : s));
          localStorage.setItem("active_investigation_steps", JSON.stringify(next));
          return next;
        });
      }

      if (data.type === "step_completed") {
        setSteps((prev) => {
          const next = prev.map((s) => (s.id === data.step ? { ...s, status: "complete" as const, durationMs: data.durationMs } : s));
          localStorage.setItem("active_investigation_steps", JSON.stringify(next));
          return next;
        });
      }

      if (data.type === "session_completed") {
        eventSource.close();
        setSteps((prev) => prev.map((s) => ({ ...s, status: "complete" as const })));
        localStorage.removeItem("active_investigation_session_id");
        localStorage.removeItem("active_investigation_goal");
        localStorage.removeItem("active_investigation_steps");
        setTimeout(() => {
          router.push(`/decisions/${data.decisionId}`);
        }, 800);
      }

      if (data.type === "session_failed") {
        eventSource.close();
        setError(data.error ?? "Investigation failed during execution");
        setIsRunning(false);
        setSteps((prev) =>
          prev.map((s) => (s.status === "active" ? { ...s, status: "failed" as const } : s))
        );
        localStorage.removeItem("active_investigation_session_id");
        localStorage.removeItem("active_investigation_goal");
        localStorage.removeItem("active_investigation_steps");
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (localStorage.getItem("active_investigation_session_id") === sessionId) {
        setError("Connection to reasoning engine lost");
        setIsRunning(false);
        localStorage.removeItem("active_investigation_session_id");
        localStorage.removeItem("active_investigation_goal");
        localStorage.removeItem("active_investigation_steps");
      }
    };

    return eventSource;
  };

  useEffect(() => {
    const activeSessionId = localStorage.getItem("active_investigation_session_id");
    const activeGoal = localStorage.getItem("active_investigation_goal");
    const activeSteps = localStorage.getItem("active_investigation_steps");

    if (activeSessionId && activeGoal) {
      setGoal(activeGoal);
      if (activeSteps) {
        try {
          setSteps(JSON.parse(activeSteps));
        } catch {
          // ignore parsing error
        }
      }
      const eventSource = connectSseStream(activeSessionId, activeGoal);

      return () => {
        if (eventSource) {
          eventSource.close();
        }
      };
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    const initialSteps = PIPELINE_STEPS.map((s) => ({ ...s, status: "pending" as const }));
    setSteps(initialSteps);

    try {
      const { sessionId } = await agentApi.startSession({ goal: goal.trim() });

      // Save active session metadata to localStorage
      localStorage.setItem("active_investigation_session_id", sessionId);
      localStorage.setItem("active_investigation_goal", goal.trim());
      localStorage.setItem("active_investigation_steps", JSON.stringify(initialSteps));

      connectSseStream(sessionId, goal.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start investigation";
      setError(message);
      setIsRunning(false);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-black text-text-primary tracking-tight">Agent Investigation</h2>
            <p className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Autonomous Analysis Engine</p>
          </div>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-full border border-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Running</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Textarea */}
          <div className="relative">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe the operational problem or anomaly to investigate..."
              disabled={isRunning}
              rows={3}
              className={cn(
                "w-full bg-surface-1/80 border border-white/[0.08] rounded-xl px-4 py-3",
                "text-sm text-text-primary placeholder:text-text-disabled",
                "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
                "resize-none transition-all duration-200 font-medium",
                isRunning && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>

          {/* Example goals as chips */}
          {!isRunning && !goal && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setGoal(example)}
                  className="text-[10px] font-bold text-text-disabled hover:text-accent border border-white/[0.06] hover:border-accent/30 rounded-lg px-3 py-1.5 transition-all hover:bg-accent/5 uppercase tracking-wide"
                >
                  {example.slice(0, 48)}…
                </button>
              ))}
            </div>
          )}

          {/* Live Pipeline View — shown while running */}
          {isRunning && (
            <div className="py-4 px-2 border border-white/[0.04] rounded-xl bg-white/[0.01] animate-fade-in">
              <div className="mb-4 text-center">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                  Agent Reasoning Pipeline
                </p>
              </div>
              <LivePipelineView steps={steps} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Submit row */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
              {isRunning ? "OpsMind is reasoning autonomously…" : "8-step agentic reasoning pipeline"}
            </p>
            <button
              type="submit"
              disabled={!goal.trim() || isRunning}
              className={cn(
                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all duration-300",
                "bg-gradient-to-r from-accent to-accent-hover text-white",
                "shadow-glow-accent hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none",
                !isRunning && goal && "hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Investigating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  Launch Investigation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

