"use client";

import { cn } from "@/lib/utils";

export interface PipelineStepState {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "complete" | "failed";
  durationMs?: number;
  detail?: string;
}

const DEFAULT_STEPS: PipelineStepState[] = [
  { id: "context", label: "Context", icon: "📡", status: "pending" },
  { id: "decompose", label: "Decompose", icon: "🔬", status: "pending" },
  { id: "plan", label: "Plan", icon: "📋", status: "pending" },
  { id: "execute", label: "Execute", icon: "⚡", status: "pending" },
  { id: "synthesize", label: "Synthesize", icon: "🧠", status: "pending" },
  { id: "reflect", label: "Reflect", icon: "🪞", status: "pending" },
  { id: "persist", label: "Persist", icon: "💾", status: "pending" },
];

interface LivePipelineViewProps {
  steps?: PipelineStepState[];
  className?: string;
}

/**
 * Real-time 8-step pipeline visualization.
 * Shows the agent "thinking" live — the centerpiece visual for YC demos.
 */
export function LivePipelineView({
  steps = DEFAULT_STEPS,
  className,
}: LivePipelineViewProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: horizontal pipeline */}
      <div className="hidden md:flex items-center gap-0 w-full">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step node */}
            <div
              className={cn(
                "flex flex-col items-center gap-1 min-w-[64px]",
                "transition-all duration-500",
                step.status === "pending" && "opacity-30",
                step.status === "active" && "opacity-100",
                step.status === "complete" && "opacity-100",
                step.status === "failed" && "opacity-100",
              )}
              style={{
                animationDelay: `${i * 0.08}s`,
              }}
            >
              {/* Circle */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm",
                  "border-2 transition-all duration-500",
                  step.status === "pending" && "border-border bg-surface-2",
                  step.status === "active" && "border-accent bg-accent/20 shadow-glow-accent",
                  step.status === "complete" && "border-success bg-success/10",
                  step.status === "failed" && "border-danger bg-danger/10",
                )}
              >
                {step.status === "active" ? (
                  <span className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : step.status === "complete" ? (
                  <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : step.status === "failed" ? (
                  <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span className="text-xs">{step.icon}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-2xs font-medium transition-colors duration-300",
                  step.status === "active" && "text-accent",
                  step.status === "complete" && "text-success",
                  step.status === "failed" && "text-danger",
                  step.status === "pending" && "text-text-muted",
                )}
              >
                {step.label}
              </span>

              {/* Duration or detail */}
              {step.durationMs !== undefined && step.status === "complete" && (
                <span className="text-2xs text-text-muted tabular-nums">
                  {step.durationMs < 1000
                    ? `${step.durationMs}ms`
                    : `${(step.durationMs / 1000).toFixed(1)}s`}
                </span>
              )}
              {step.status === "active" && step.detail && (
                <span className="text-2xs text-accent/70 max-w-[80px] truncate text-center">
                  {step.detail}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-1 transition-all duration-700",
                  step.status === "complete" && steps[i + 1]?.status !== "pending"
                    ? "bg-gradient-to-r from-success to-success/50"
                    : step.status === "complete"
                      ? "bg-gradient-to-r from-success/50 to-border"
                      : step.status === "active"
                        ? "bg-gradient-to-r from-accent/50 to-border"
                        : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical pipeline */}
      <div className="md:hidden space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
              step.status === "active" && "bg-accent/10 border border-accent/20",
              step.status === "complete" && "opacity-70",
              step.status === "pending" && "opacity-30",
            )}
          >
            <span className="text-sm">{step.icon}</span>
            <span
              className={cn(
                "text-xs font-medium flex-1",
                step.status === "active" && "text-accent",
                step.status === "complete" && "text-success",
                step.status === "pending" && "text-text-muted",
              )}
            >
              {step.label}
            </span>
            {step.status === "active" && (
              <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            )}
            {step.status === "complete" && step.durationMs !== undefined && (
              <span className="text-2xs text-text-muted tabular-nums">
                {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
