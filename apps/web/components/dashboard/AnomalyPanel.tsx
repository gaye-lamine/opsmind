import type { DetectedAnomaly } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime, cn } from "@/lib/utils";
import Link from "next/link";

interface AnomalyPanelProps {
  anomalies: DetectedAnomaly[];
}

const severityConfig: Record<string, { variant: "danger" | "warning" | "muted"; color: string; border: string }> = {
  critical: { variant: "danger", color: "text-danger", border: "glow-border-danger" },
  high: { variant: "danger", color: "text-danger", border: "border-danger/30" },
  medium: { variant: "warning", color: "text-warning", border: "border-warning/30" },
  low: { variant: "muted", color: "text-text-muted", border: "border-border" },
};

export function AnomalyPanel({ anomalies }: AnomalyPanelProps) {
  const active = anomalies.filter(
    (a) => a.status !== "resolved" && a.status !== "dismissed"
  );

  return (
    <Card padding="none" variant="glass" className="h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <CardTitle className="!text-text-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Active Anomalies
          </CardTitle>
          {active.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-0.5 bg-warning/10 rounded-full">
              <span className="status-dot-reflecting !w-1.5 !h-1.5" />
              <span className="text-[10px] font-bold text-warning uppercase">{active.length} Detect</span>
            </div>
          )}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-success/5 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-success/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-muted">System behavior normal</p>
          <p className="text-2xs text-text-disabled mt-1 uppercase tracking-widest">No deviations detected</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03] overflow-y-auto flex-1 custom-scrollbar">
          {active.map((anomaly, i) => {
            const config = (severityConfig[anomaly.severity] ?? severityConfig.low) as { variant: "danger" | "warning" | "muted"; color: string; border: string };
            return (
              <div 
                key={anomaly.id} 
                className={cn(
                  "p-4 group transition-all duration-300 hover:bg-white/[0.03] relative border-l-2 border-transparent animate-slide-up",
                  `stagger-${(i % 5) + 1}`,
                  anomaly.severity === "critical" && "bg-danger/[0.02]"
                )}
                style={{ borderLeftColor: `var(--${config.variant})` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={config.variant} className="px-1.5 py-0 text-[9px] font-black uppercase tracking-tighter">
                        {anomaly.severity}
                      </Badge>
                      <span className="text-xs font-bold text-text-primary tracking-tight truncate">
                        {anomaly.metric.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
                      {anomaly.description}
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <Link 
                        href={`/investigate?goal=Investigate ${anomaly.metric} anomaly: ${anomaly.description}`}
                        className="text-[10px] font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors uppercase tracking-widest"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        Launch Investigation
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                      {formatRelativeTime(anomaly.detectedAt.toString())}
                    </span>
                    {anomaly.severity === "critical" && (
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-danger opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

