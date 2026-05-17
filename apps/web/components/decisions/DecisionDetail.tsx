import Link from "next/link";
import type { Decision } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import { ExecutedActionsPanel } from "@/components/decisions/ExecutedActionsPanel";
import {
  formatConfidence,
  formatTimestamp,
  formatDuration,
  severityColor,
  cn,
} from "@/lib/utils";

interface DecisionDetailProps {
  decision: Decision;
}

export function DecisionDetail({ decision }: DecisionDetailProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Back link */}
      <Link
        href="/decisions"
        className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-accent transition-colors uppercase tracking-widest"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Intelligence Ledger
      </Link>

      {/* ─── Hero Card ──────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative flex items-start gap-6">
          <ConfidenceGauge value={decision.confidenceScore} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge
                variant={decision.confidenceLevel === "very_high" || decision.confidenceLevel === "high" ? "success" : decision.confidenceLevel === "medium" ? "warning" : "danger"}
                className="px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter"
              >
                {formatConfidence(decision.confidenceScore)} confidence
              </Badge>
              <Badge variant="muted" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter">
                {decision.category.replace(/_/g, " ")}
              </Badge>
            </div>
            <h1 className="text-xl font-black text-text-primary leading-snug tracking-tight mb-3">
              {decision.goal}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-text-disabled uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {formatTimestamp(decision.createdAt.toString())}
              </span>
              <span>{formatDuration(decision.reasoningTrace.totalDurationMs)}</span>
              <span>{decision.reasoningTrace.modelUsed}</span>
              <span>{decision.toolsUsed.length} tools</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Summary ────────────────────────────────────────────────────────── */}
      <Card variant="glass" className="p-6">
        <CardTitle className="mb-3 !text-text-primary">Executive Summary</CardTitle>
        <p className="text-sm text-text-secondary leading-relaxed">{decision.summary}</p>
      </Card>

      {/* ─── Findings ───────────────────────────────────────────────────────── */}
      <Card variant="glass" padding="none">
        <div className="p-5 border-b border-white/[0.05] bg-white/[0.02]">
          <CardTitle className="!text-text-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            Findings ({decision.findings.length})
          </CardTitle>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {decision.findings.map((finding, i) => (
            <div key={finding.id} className={cn("p-5 border-l-2 border-transparent animate-slide-up", `stagger-${(i % 5) + 1}`)}>
              <div className="flex items-start gap-3">
                <Badge
                  variant={finding.severity === "critical" ? "danger" : finding.severity === "warning" ? "warning" : "muted"}
                  className="px-1.5 py-0 text-[9px] font-black uppercase tracking-tighter mt-0.5 shrink-0"
                >
                  {finding.severity}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary tracking-tight">{finding.title}</p>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{finding.description}</p>
                  {finding.evidence.length > 0 && (
                    <div className="mt-3 space-y-1.5 pl-3 border-l border-white/[0.06]">
                      {finding.evidence.map((e, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className="text-accent/50 text-xs mt-0.5">›</span>
                          <span className="text-xs text-text-muted leading-relaxed">{e}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Recommendations ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Action Recommendations</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
          <span className="text-[10px] font-bold text-text-disabled">Pending human execution</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {decision.recommendations.map((rec, i) => {
            const prioVariant = rec.priority === "immediate" ? "danger" : rec.priority === "high" ? "warning" : rec.priority === "medium" ? "accent" : "muted";
            return (
              <Card key={rec.id} variant="glass" hover className={cn("animate-slide-up", `stagger-${(i % 4) + 1}`)}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={prioVariant} className="px-1.5 py-0 text-[9px] font-black uppercase tracking-tighter">
                    {rec.priority}
                  </Badge>
                  <p className="text-sm font-bold text-text-primary tracking-tight truncate">{rec.title}</p>
                </div>
                <p className="text-xs text-text-secondary mb-3 line-clamp-2">{rec.description}</p>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.04]">
                  <div>
                    <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Impact</span>
                    <p className="text-xs text-text-secondary mt-1">{rec.estimatedImpact}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Timeframe</span>
                    <p className="text-xs text-text-secondary mt-1">{rec.timeframe}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Reflection ─────────────────────────────────────────────────────── */}
      {decision.reflection && (
        <Card variant="glass" padding="none">
          <div className="p-5 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
            <CardTitle className="!text-text-primary flex items-center gap-2">
              <span className="text-base">🪞</span> Reflection Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <ConfidenceGauge value={decision.reflection.overallScore} size="sm" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Quality</span>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Confidence Assessment</span>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{decision.reflection.confidenceAssessment}</p>
            </div>
            {decision.reflection.identifiedRisks.length > 0 && (
              <div>
                <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Identified Risks</span>
                <ul className="mt-2 space-y-2">
                  {decision.reflection.identifiedRisks.map((risk, i) => (
                    <li key={i} className="text-xs text-warning flex items-start gap-2 bg-warning/5 border border-warning/10 rounded-lg px-3 py-2">
                      <span className="mt-0.5 shrink-0">⚠</span> <span className="leading-relaxed">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.reflection.alternativeApproaches.length > 0 && (
              <div>
                <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Alternative Approaches</span>
                <ul className="mt-2 space-y-2">
                  {decision.reflection.alternativeApproaches.map((alt, i) => (
                    <li key={i} className="text-xs text-text-secondary flex items-start gap-2 pl-3 border-l-2 border-accent/20">
                      <span className="leading-relaxed">{alt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ─── Reasoning Trace ────────────────────────────────────────────────── */}
      <Card variant="glass" padding="none">
        <div className="p-5 border-b border-white/[0.05] bg-white/[0.02]">
          <CardTitle className="!text-text-primary">Reasoning Trace</CardTitle>
        </div>
        <div className="p-5 space-y-3">
          {decision.reasoningTrace.steps.map((step, i) => (
            <div key={i} className={cn("flex items-start gap-3 animate-slide-up", `stagger-${(i % 5) + 1}`)}>
              <div className="w-6 h-6 rounded-full bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-text-primary tracking-tight">{step.step}</span>
                  <span className="text-[10px] font-mono text-text-disabled tabular-nums">{formatDuration(step.durationMs)}</span>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{step.input}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Autonomous Actions Executed ─────────────────────────────────────── */}
      <ExecutedActionsPanel
        decisionId={decision.id}
        sessionId={decision.sessionId}
        goal={decision.goal}
        category={decision.category}
      />
    </div>
  );
}
