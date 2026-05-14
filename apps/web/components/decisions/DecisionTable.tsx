import Link from "next/link";
import type { DecisionSummary, PaginationMeta } from "@opsmind/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime, formatConfidence, truncate } from "@/lib/utils";

interface DecisionTableProps {
  decisions: DecisionSummary[];
  pagination: PaginationMeta | null;
}

const categoryLabel: Record<string, string> = {
  anomaly_resolution: "Anomaly",
  strategic_recommendation: "Strategy",
  operational_action: "Operations",
  risk_mitigation: "Risk",
  performance_optimization: "Performance",
  monitoring_alert: "Alert",
};

const statusVariant: Record<string, "success" | "warning" | "muted" | "accent"> = {
  finalized: "success",
  reflected: "accent",
  pending_reflection: "warning",
  draft: "muted",
  superseded: "muted",
};

const confidenceVariant = (level: string): "success" | "warning" | "danger" | "muted" => {
  if (level === "very_high" || level === "high") return "success";
  if (level === "medium") return "warning";
  return "danger";
};

export function DecisionTable({ decisions, pagination }: DecisionTableProps) {
  if (decisions.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-muted">
          No decisions yet. Start an investigation from the dashboard.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-2xs text-text-muted uppercase tracking-wider">
        <div className="col-span-5">Goal</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1">Confidence</div>
        <div className="col-span-1">Status</div>
        <div className="col-span-1">Actions</div>
        <div className="col-span-2 text-right">Time</div>
      </div>

      {/* Rows */}
      {decisions.map((decision) => (
        <Link key={decision.id} href={`/decisions/${decision.id}`}>
          <Card
            padding="sm"
            className="grid grid-cols-12 gap-3 items-center hover:border-border-strong hover:bg-surface-3 transition-all cursor-pointer"
          >
            <div className="col-span-5 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {truncate(decision.goal, 100)}
              </p>
              <p className="text-2xs text-text-muted mt-0.5 line-clamp-1">
                {truncate(decision.summary, 80)}
              </p>
            </div>

            <div className="col-span-2">
              <Badge variant="muted">
                {categoryLabel[decision.category] ?? decision.category}
              </Badge>
            </div>

            <div className="col-span-1">
              <Badge variant={confidenceVariant(decision.confidenceLevel)}>
                {formatConfidence(decision.confidenceScore)}
              </Badge>
            </div>

            <div className="col-span-1">
              <Badge variant={statusVariant[decision.status] ?? "muted"}>
                {decision.status.replace("_", " ")}
              </Badge>
            </div>

            <div className="col-span-1">
              <span className="text-xs text-text-muted">
                {decision.recommendationCount}
              </span>
            </div>

            <div className="col-span-2 text-right">
              <span className="text-2xs text-text-muted">
                {formatRelativeTime(decision.createdAt)}
              </span>
            </div>
          </Card>
        </Link>
      ))}

      {pagination && (
        <div className="text-center pt-2">
          <span className="text-xs text-text-muted">
            Showing {decisions.length} of {pagination.total} decisions
          </span>
        </div>
      )}
    </div>
  );
}
