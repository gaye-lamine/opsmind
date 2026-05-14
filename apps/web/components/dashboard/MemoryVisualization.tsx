import type { DecisionSummary, OperationalState } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";
import Link from "next/link";

interface MemoryVisualizationProps {
  decisions: DecisionSummary[];
  operationalState: OperationalState | null;
  totalDecisions: number;
}

export function MemoryVisualization({
  decisions,
  operationalState,
  totalDecisions,
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

      {/* Decision timeline */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <CardTitle>Decision Timeline</CardTitle>
        </div>
        <div className="divide-y divide-border">
          {decisions.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-text-muted">No decisions recorded yet.</p>
            </div>
          ) : (
            decisions.map((d) => (
              <Link key={d.id} href={`/decisions/${d.id}`}>
                <div className="flex items-center gap-4 p-4 hover:bg-surface-3 transition-colors cursor-pointer">
                  <div className="w-1 h-8 rounded-full bg-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{d.goal}</p>
                    <p className="text-2xs text-text-muted mt-0.5">{d.category.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={d.confidenceLevel === "high" || d.confidenceLevel === "very_high" ? "success" : "warning"}>
                      {formatConfidence(d.confidenceScore)}
                    </Badge>
                    <span className="text-2xs text-text-muted">
                      {formatRelativeTime(d.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
