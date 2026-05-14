import type { ActionRecommendation } from "@opsmind/shared";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface PendingActionsPanelProps {
  actions: ActionRecommendation[];
}

const priorityConfig: Record<string, { variant: "danger" | "warning" | "accent" | "muted"; label: string; bg: string; text: string }> = {
  immediate: { variant: "danger", label: "Immediate", bg: "bg-danger/10", text: "text-danger" },
  high: { variant: "warning", label: "High Priority", bg: "bg-warning/10", text: "text-warning" },
  medium: { variant: "accent", label: "Recommended", bg: "bg-accent/10", text: "text-accent" },
  low: { variant: "muted", label: "Backlog", bg: "bg-white/5", text: "text-text-muted" },
};

export function PendingActionsPanel({ actions }: PendingActionsPanelProps) {
  const sorted = [...actions].sort((a, b) => {
    const order = { immediate: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  return (
    <Card padding="none" variant="glass" className="h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <CardTitle className="!text-text-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Command Directives
          </CardTitle>
          {actions.length > 0 && (
            <Badge variant="accent" className="px-2 py-0.5 text-[10px] font-black">{actions.length} Action{actions.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-accent/5 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-accent/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-muted">Directives clear</p>
          <p className="text-2xs text-text-disabled mt-1 uppercase tracking-widest">Awaiting new decisions</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03] overflow-y-auto flex-1 custom-scrollbar">
          {sorted.slice(0, 8).map((action, i) => {
            const config = priorityConfig[action.priority] ?? priorityConfig.low;
            return (
              <div 
                key={action.id} 
                className={cn(
                  "p-4 group transition-all duration-300 hover:bg-white/[0.03] animate-slide-up",
                  `stagger-${(i % 5) + 1}`
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 w-1.5 h-1.5 rounded-full shrink-0", config.text.replace("text-", "bg-"))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors tracking-tight">
                        {action.title}
                      </p>
                      <Badge variant={config.variant} className="px-1 py-0 text-[8px] font-black uppercase tracking-tighter shrink-0">
                        {config.label}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-text-secondary line-clamp-1 mb-2">
                      {action.estimatedImpact}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-text-disabled uppercase tracking-widest">
                        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {action.timeframe}
                      </div>
                      <button className="text-[10px] font-black text-text-muted hover:text-text-primary uppercase tracking-tighter flex items-center gap-1 transition-colors">
                        Queue
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {sorted.length > 8 && (
            <div className="p-3 text-center bg-white/[0.01]">
              <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                +{sorted.length - 8} Additional Directives
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

