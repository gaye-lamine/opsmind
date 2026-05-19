import type { DecisionSummary, OperationalState } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatConfidence } from "@/lib/utils";
import { SearchableMemory } from "./SearchableMemory";

interface MemoryVisualizationProps {
  decisions: DecisionSummary[];
  operationalState: OperationalState | null;
  totalDecisions: number;
  mongoStats: Record<string, number> | null;
}

export function MemoryVisualization({
  decisions,
  operationalState,
  totalDecisions,
  mongoStats,
}: MemoryVisualizationProps) {
  // Group decisions by category for pattern visualization
  const byCategory = decisions.reduce<Record<string, DecisionSummary[]>>(
    (acc, d) => {
      const key = d.category;
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(d);
      return acc;
    },
    {}
  );

  const avgConfidence =
    decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.confidenceScore, 0) / decisions.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Memory stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">Total Decisions</div>
          <div className="text-2xl font-bold text-text-primary tabular-nums">{totalDecisions}</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">Avg Confidence</div>
          <div className="text-2xl font-bold text-success tabular-nums">
            {formatConfidence(avgConfidence)}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">Active Anomalies</div>
          <div className="text-2xl font-bold text-warning tabular-nums">
            {operationalState?.anomalies.filter(a => a.status !== "resolved").length ?? 0}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">Tracked Metrics</div>
          <div className="text-2xl font-bold text-accent tabular-nums">
            {operationalState?.metrics.length ?? 0}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Decision categories breakdown */}
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <CardTitle>Decision Categories</CardTitle>
          </div>
          <div className="p-4">
            {Object.keys(byCategory).length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No decisions in memory yet.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byCategory).map(([category, items]) => {
                  const pct = Math.round((items.length / decisions.length) * 100);
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-secondary">
                          {category.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-text-muted">
                          {items.length} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* MongoDB Stats Panel */}
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <CardTitle>MongoDB Atlas Store Stats</CardTitle>
          </div>
          <div className="p-4 space-y-3.5">
            {[
              { label: "Decisions (Memory Vectors)", count: mongoStats?.decisions ?? 0, color: "bg-accent" },
              { label: "Remediation Actions", count: mongoStats?.actions ?? 0, color: "bg-success" },
              { label: "Operational State Snapshot", count: mongoStats?.states ?? 0, color: "bg-warning" },
              { label: "Agent Execution Logs", count: mongoStats?.logs ?? 0, color: "bg-danger" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-text-secondary">{item.label}</span>
                </div>
                <span className="font-mono text-text-primary font-bold">{item.count} doc{item.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Decision timeline (Searchable) */}
      <SearchableMemory initialDecisions={decisions} />
    </div>
  );
}
