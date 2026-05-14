"use client";

import { cn } from "@/lib/utils";

const PIPELINE_STEPS = [
  { id: "context_assembly", label: "Context Assembly" },
  { id: "goal_decomposition", label: "Goal Decomposition" },
  { id: "planning", label: "Planning" },
  { id: "execution", label: "Tool Execution" },
  { id: "decision_synthesis", label: "Decision Synthesis" },
  { id: "reflection", label: "Reflection" },
  { id: "memory_persistence", label: "Memory Persistence" },
];

interface PipelineProgressProps {
  currentStep: string;
  completedSteps?: string[];
}

export function PipelineProgress({
  currentStep,
  completedSteps = [],
}: PipelineProgressProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-md p-3">
      <div className="text-2xs text-text-muted uppercase tracking-wider mb-2.5">
        Reasoning Pipeline
      </div>
      <div className="space-y-1.5">
        {PIPELINE_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep.toLowerCase().includes(step.id.replace("_", " ")) ||
            currentStep.toLowerCase().includes(step.label.toLowerCase());
          const isPending = !isCompleted && !isActive;

          return (
            <div key={step.id} className="flex items-center gap-2.5">
              {/* Step indicator */}
              <div className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                isCompleted && "bg-success",
                isActive && "bg-accent animate-pulse-slow",
                isPending && "bg-surface-3 border border-border"
              )}>
                {isCompleted && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
                {isPending && (
                  <span className="text-2xs text-text-disabled font-mono">{index + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span className={cn(
                "text-xs",
                isCompleted && "text-success",
                isActive && "text-accent font-medium",
                isPending && "text-text-disabled"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current status text */}
      <div className="mt-3 pt-2.5 border-t border-border">
        <p className="text-xs text-text-secondary">{currentStep}</p>
      </div>
    </div>
  );
}
