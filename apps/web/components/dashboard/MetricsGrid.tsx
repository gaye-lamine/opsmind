import type { BusinessMetric } from "@opsmind/shared";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface MetricsGridProps {
  metrics: BusinessMetric[];
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  if (metrics.length === 0) {
    return (
      <Card variant="glass" className="text-center py-12">
        <p className="text-base text-text-muted">
          No metrics available. Run an investigation to populate operational state.
        </p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in stagger-1">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em]">
          Business Vitality Metrics
        </h2>
        <span className="text-[10px] text-text-disabled font-mono uppercase tracking-widest">
          Live Operational State
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metrics.map((metric, i) => (
          <MetricCard key={metric.name} metric={metric} index={i} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric, index }: { metric: BusinessMetric; index: number }) {
  // Transform metric names like "CUSTOMER_ACQUISITION_COST" to "Customer Acquisition Cost"
  const humanName = metric.name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const trendIcon = {
    up: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
      </svg>
    ),
    down: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
      </svg>
    ),
    stable: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15" />
      </svg>
    ),
    volatile: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  }[metric.trend];

  const trendColor = {
    up: metric.name.toLowerCase().includes("cost") || metric.name.toLowerCase().includes("churn") ? "text-danger" : "text-success",
    down: metric.name.toLowerCase().includes("cost") || metric.name.toLowerCase().includes("churn") ? "text-success" : "text-danger",
    stable: "text-text-muted",
    volatile: "text-warning",
  }[metric.trend];

  // Simple deterministic sparkline based on value and trend
  const generateSparkline = () => {
    const points = [];
    const seed = metric.value % 100;
    for (let i = 0; i < 10; i++) {
      let val = 15 + (Math.sin(seed + i) * 10);
      if (metric.trend === "up") val -= i * 1.5;
      if (metric.trend === "down") val += i * 1.5;
      points.push(`${i * 10},${val}`);
    }
    return points.join(" ");
  };

  return (
    <Card
      variant="glass"
      hover
      padding="md"
      className={cn(
        "relative group overflow-hidden animate-slide-up",
        `stagger-${(index % 5) + 1}`,
        metric.isAnomaly && "glow-border-warning"
      )}
    >
      {/* Background Sparkline Decal */}
      <div className="absolute bottom-0 left-0 w-full h-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
        <svg width="100%" height="100%" viewBox="0 0 90 30" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={generateSparkline()}
            className={trendColor}
          />
        </svg>
      </div>

      {metric.isAnomaly && (
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-warning/10 border border-warning/20 rounded-md">
            <span className="status-dot-reflecting !w-1.5 !h-1.5" />
            <span className="text-[9px] font-bold text-warning uppercase tracking-wider">Anomaly</span>
          </div>
        </div>
      )}

      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 transition-colors group-hover:text-text-secondary">
        {humanName}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-black text-text-primary tabular-nums tracking-tight">
          {metric.value.toLocaleString()}
        </span>
        <span className="text-xs font-semibold text-text-disabled tracking-wide">{metric.unit}</span>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/[0.03]">
        <span className="text-[10px] font-medium text-text-disabled uppercase">{metric.period}</span>
        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.02]", trendColor)}>
          {metric.changePercent !== undefined && (
            <span className="text-xs font-bold tabular-nums">
              {metric.changePercent > 0 ? "+" : ""}
              {metric.changePercent.toFixed(1)}%
            </span>
          )}
          {trendIcon}
        </div>
      </div>
    </Card>
  );
}

