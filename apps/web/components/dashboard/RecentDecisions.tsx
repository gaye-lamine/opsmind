import Link from "next/link";
import type { DecisionSummary } from "@opsmind/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import { formatRelativeTime, truncate, cn } from "@/lib/utils";

interface RecentDecisionsProps {
  decisions: DecisionSummary[];
}

const categoryLabel: Record<string, { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  anomaly_resolution: { label: "Anomaly", variant: "warning" },
  strategic_recommendation: { label: "Strategy", variant: "success" },
  operational_action: { label: "Operations", variant: "muted" },
  risk_mitigation: { label: "Risk", variant: "danger" },
  performance_optimization: { label: "Performance", variant: "success" },
  monitoring_alert: { label: "Alert", variant: "warning" },
};

export function RecentDecisions({ decisions }: RecentDecisionsProps) {
  return (
    <div className="animate-fade-in stagger-2">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em]">
          Intelligence Ledger
        </h2>
        <Link
          href="/decisions"
          className="text-[10px] font-bold text-accent hover:text-accent-hover transition-colors uppercase tracking-widest flex items-center gap-1.5"
        >
          Archive
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {decisions.length === 0 ? (
        <Card variant="glass" className="text-center py-10">
          <p className="text-sm text-text-muted">
            Organizational memory is currently empty.
          </p>
          <p className="text-2xs text-text-disabled mt-1 uppercase tracking-widest">
            Run an investigation to generate decisions
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision, i) => {
            const config = categoryLabel[decision.category] || { label: decision.category, variant: "muted" };
            return (
              <Link key={decision.id} href={`/decisions/${decision.id}`}>
                <Card
                  variant="glass"
                  padding="none"
                  hover
                  className={cn(
                    "group transition-all duration-300 animate-slide-up",
                    `stagger-${(i % 5) + 1}`
                  )}
                >
                  <div className="flex items-stretch gap-0">
                    {/* Visual bar indicating confidence */}
                    <div className={cn(
                      "w-1 transition-all duration-300 group-hover:w-1.5",
                      decision.confidenceScore >= 0.8 ? "bg-success" : decision.confidenceScore >= 0.6 ? "bg-warning" : "bg-danger"
                    )} />
                    
                    <div className="flex-1 p-4 flex items-start gap-4">
                      {/* Confidence Gauge */}
                      <div className="flex-shrink-0 pt-1">
                        <ConfidenceGauge value={decision.confidenceScore} size="md" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant={config.variant} className="px-1.5 py-0 text-[9px] font-black uppercase tracking-tighter">
                            {config.label}
                          </Badge>
                          <p className="text-xs font-bold text-text-primary tracking-tight truncate group-hover:text-accent transition-colors">
                            {decision.goal}
                          </p>
                        </div>
                        
                        <p className="text-xs text-text-secondary line-clamp-1 mb-2">
                          {decision.summary}
                        </p>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-disabled uppercase tracking-wide">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                            {decision.recommendationCount} Recommendations
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                            <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatRelativeTime(decision.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Chevron */}
                      <div className="flex items-center self-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

