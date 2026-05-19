"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { playbookApi, type Playbook } from "../../services/api-client/playbook.api";

interface PlaybookConsoleProps {
  decisionId: string;
}

export function PlaybookConsole({ decisionId }: PlaybookConsoleProps) {
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [executingStepId, setExecutingStepId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlaybook() {
      try {
        setLoading(true);
        const data = await playbookApi.getOrCreate(decisionId);
        setPlaybook(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load playbook", err);
        setError("Unable to generate dynamic playbook. Please check backend connectivity.");
      } finally {
        setLoading(false);
      }
    }

    if (decisionId) {
      loadPlaybook();
    }
  }, [decisionId]);

  const handleToggleStep = async (stepId: string, currentStatus: "pending" | "completed" | "skipped") => {
    try {
      const nextStatus = currentStatus === "completed" ? "pending" : "completed";
      const updated = await playbookApi.toggleStep(decisionId, stepId, nextStatus);
      setPlaybook(updated);
    } catch (err) {
      console.error("Failed to toggle step", err);
    }
  };

  const handleExecuteStep = async (stepId: string) => {
    try {
      setExecutingStepId(stepId);
      const updated = await playbookApi.executeStep(decisionId, stepId);
      setPlaybook(updated);
    } catch (err) {
      console.error("Failed to execute step", err);
    } finally {
      setExecutingStepId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mt-8">
        <Card variant="glass" className="p-6 space-y-4 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
          <div className="h-10 bg-white/5 rounded"></div>
          <div className="space-y-2">
            <div className="h-6 bg-white/5 rounded"></div>
            <div className="h-6 bg-white/5 rounded w-5/6"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !playbook) {
    return (
      <div className="max-w-5xl mx-auto mt-8">
        <Card variant="glass" className="p-6 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3 text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-bold font-mono">{error || "Playbook could not be generated"}</span>
          </div>
        </Card>
      </div>
    );
  }

  const completedSteps = playbook.steps.filter(s => s.status === "completed" || s.status === "skipped").length;
  const progressPercent = Math.round((completedSteps / playbook.steps.length) * 100);

  return (
    <div className="max-w-5xl mx-auto mt-8 space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Remediation Playbook</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Interactive Vector RAG
        </span>
      </div>

      <Card variant="glass" className="p-6 relative overflow-hidden">
        {/* Glowing aura background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Playbook Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-1 flex items-center gap-2">
              {playbook.title}
              {playbook.status === "completed" && (
                <Badge variant="success" className="text-[9px] px-1.5 py-0.5 uppercase tracking-wider">Resolved</Badge>
              )}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {playbook.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
            <span className="text-[10px] font-mono text-text-muted">
              {completedSteps} of {playbook.steps.length} steps ({progressPercent}%)
            </span>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {playbook.steps.map((step) => {
            const isCompleted = step.status === "completed" || step.status === "skipped";
            const isExecuting = executingStepId === step.id;

            return (
              <div 
                key={step.id} 
                className={`p-4 rounded-lg border transition-all duration-300 flex items-start gap-4 ${
                  isCompleted 
                    ? "bg-emerald-500/[0.02] border-emerald-500/10 opacity-75" 
                    : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.02]"
                }`}
              >
                {/* Checkbox wrapper */}
                <button 
                  onClick={() => handleToggleStep(step.id, step.status)}
                  className={`mt-0.5 w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                    isCompleted 
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-400" 
                      : "border-white/20 hover:border-white/40 text-transparent"
                  }`}
                  aria-label="Toggle step completed"
                >
                  <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold font-mono text-text-muted">STEP {step.stepNumber}</span>
                    <h4 className={`text-xs font-bold leading-tight ${isCompleted ? "line-through text-text-secondary" : "text-text-primary"}`}>
                      {step.title}
                    </h4>
                    {step.autoRemediationAvailable && (
                      <Badge variant="warning" className="text-[8px] px-1 py-0 uppercase tracking-widest font-mono">
                        Auto-Remediable
                      </Badge>
                    )}
                    {step.system && (
                      <Badge variant="muted" className="text-[8px] px-1 py-0 uppercase tracking-widest font-mono">
                        {step.system}
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    {step.description}
                  </p>

                  {/* Render detail specs if present */}
                  {step.details && Object.keys(step.details).length > 0 && (
                    <div className="mt-2 bg-black/20 rounded p-2 text-[10px] font-mono text-indigo-300 border border-white/[0.02] max-w-lg">
                      <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wider">Payload Specs:</div>
                      {JSON.stringify(step.details, null, 2)}
                    </div>
                  )}
                </div>

                {/* Automation trigger button */}
                {step.autoRemediationAvailable && !isCompleted && (
                  <button
                    disabled={isExecuting}
                    onClick={() => handleExecuteStep(step.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuting ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Run Auto-Action
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
