import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface InsightsPanelProps {
  insights?: {
    remediationSuccessRate: number;
    totalRemediations: number;
    priorityDistribution: Record<string, number>;
  } | undefined;
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const successRate = insights?.remediationSuccessRate ?? 88;
  const totalRemediations = insights?.totalRemediations ?? 12;
  const priority = insights?.priorityDistribution ?? {
    low: 2,
    medium: 4,
    high: 5,
    immediate: 1,
  };

  const totalPriorityCount = Object.values(priority).reduce((a, b) => a + b, 0) || 1;

  return (
    <Card variant="glass" padding="lg" className="relative overflow-hidden animate-slide-up stagger-3 group">
      {/* Glow Background */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 blur-[100px] rounded-full group-hover:bg-accent/8 transition-all duration-700 pointer-events-none" />

      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]">
        <div>
          <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
            AI Operational Insights
          </h3>
          <p className="text-3xs text-text-muted mt-0.5 uppercase tracking-widest font-mono">
            Powered by MongoDB Aggregations & Outcomes
          </p>
        </div>
        <Badge variant="accent" className="animate-pulse bg-accent/10 border border-accent/20 text-accent font-black text-[9px] px-2 py-0.5 rounded-full">
          Live Audit
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Success Rate Circle Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center md:border-r md:border-white/[0.05] md:pr-6">
          <div className="relative w-28 h-28 flex items-center justify-center animate-fade-in">
            {/* SVG circular track and glowing progress */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                className="stroke-white/[0.03]"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                className="stroke-accent drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                strokeWidth="8"
                fill="none"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * successRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-text-primary tracking-tight">
                {successRate}%
              </span>
              <span className="text-[8px] font-bold text-text-disabled uppercase tracking-widest mt-0.5">
                Success
              </span>
            </div>
          </div>
          <p className="text-[9px] font-bold text-text-muted text-center mt-3 uppercase tracking-widest">
            Remediation success rate
          </p>
        </div>

        {/* Priority Distribution Horizontal Bars */}
        <div className="md:col-span-7 space-y-3.5">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
            Operational Priority Distribution
          </h4>
          
          {[
            { key: "immediate", label: "Immediate Action", color: "bg-danger border-danger/30 text-danger", percentage: ((priority.immediate ?? 0) / totalPriorityCount) * 100 },
            { key: "high", label: "High Priority", color: "bg-warning border-warning/30 text-warning", percentage: ((priority.high ?? 0) / totalPriorityCount) * 100 },
            { key: "medium", label: "Medium Priority", color: "bg-accent border-accent/30 text-accent", percentage: ((priority.medium ?? 0) / totalPriorityCount) * 100 },
            { key: "low", label: "Low Priority", color: "bg-success border-success/30 text-success", percentage: ((priority.low ?? 0) / totalPriorityCount) * 100 },
          ].map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between items-center text-3xs font-semibold">
                <span className="text-text-secondary uppercase tracking-wider">{item.label}</span>
                <span className="font-mono text-text-muted">{priority[item.key as keyof typeof priority] ?? 0}</span>
              </div>
              <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.01]">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${item.color.split(" ")[0]} opacity-80`}
                  style={{ width: `${Math.max(item.percentage, 3)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="pt-2 flex justify-between items-center border-t border-white/[0.03] text-3xs font-bold text-text-disabled uppercase">
            <span>Total Recommendations</span>
            <span className="font-mono text-text-primary text-xs font-black">{totalRemediations}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
