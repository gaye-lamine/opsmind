import type { SystemHealth } from "@opsmind/shared";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  systemHealth: SystemHealth | null;
  activeInvestigations: number;
}

export function DashboardHeader({
  systemHealth,
  activeInvestigations,
}: DashboardHeaderProps) {
  const healthVariant =
    systemHealth?.status === "healthy"
      ? "success"
      : systemHealth?.status === "degraded"
        ? "warning"
        : "danger";

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="gradient-text">OpsMind</span>
          <span className="text-text-primary ml-3">Operational Intelligence</span>
        </h1>
        <p className="text-base text-text-muted mt-1 max-w-2xl font-medium">
          Autonomous business reasoning engine investigating, deciding, and acting in real-time.
        </p>
      </div>

      <div className="flex items-center gap-4 animate-fade-in stagger-1">
        {activeInvestigations > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl shadow-glow-accent">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
            </span>
            <span className="text-sm text-accent font-bold tracking-tight">
              {activeInvestigations} AGENT{activeInvestigations > 1 ? "S" : ""} ACTIVE
            </span>
          </div>
        )}

        {systemHealth && (
          <div className="flex items-center gap-4 px-4 py-2 bg-surface-2/50 backdrop-blur-md border border-border/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Badge variant={healthVariant} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {systemHealth.status}
              </Badge>
            </div>
            <div className="h-4 w-px bg-border/50" />
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <span className={cn(
                "inline-block w-2 h-2 rounded-full",
                systemHealth.memoryStatus === "connected" ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              )} />
              MongoDB Atlas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

