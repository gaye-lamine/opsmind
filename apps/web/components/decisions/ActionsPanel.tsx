import type { ActionRecommendation } from "@opsmind/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ActionsPanelProps {
  actions: ActionRecommendation[];
}

const priorityVariant: Record<string, "danger" | "warning" | "accent" | "muted"> = {
  immediate: "danger",
  high: "warning",
  medium: "accent",
  low: "muted",
};

const statusVariant: Record<string, "success" | "accent" | "warning" | "muted"> = {
  completed: "success",
  in_progress: "accent",
  acknowledged: "warning",
  recommended: "muted",
  dismissed: "muted",
};

export function ActionsPanel({ actions }: ActionsPanelProps) {
  if (actions.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-muted">No pending actions.</p>
      </Card>
    );
  }

  const sorted = [...actions].sort((a, b) => {
    const order = { immediate: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  return (
    <div className="space-y-3">
      {sorted.map((action) => (
        <Card key={action.id} padding="md">
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <Badge variant={priorityVariant[action.priority] ?? "muted"}>
                {action.priority}
              </Badge>
              <Badge variant={statusVariant[action.status] ?? "muted"}>
                {action.status.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{action.title}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{action.description}</p>

              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <span className="text-2xs text-text-muted uppercase tracking-wide">Rationale</span>
                  <p className="text-xs text-text-secondary mt-0.5">{action.rationale}</p>
                </div>
                <div>
                  <span className="text-2xs text-text-muted uppercase tracking-wide">Impact</span>
                  <p className="text-xs text-text-secondary mt-0.5">{action.estimatedImpact}</p>
                </div>
                <div>
                  <span className="text-2xs text-text-muted uppercase tracking-wide">Timeframe</span>
                  <p className="text-xs text-text-secondary mt-0.5">{action.timeframe}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
