import { decisionsApi } from "@/services/api-client/decisions.api";
import { dashboardApi } from "@/services/api-client/dashboard.api";
import { MemoryVisualization } from "@/components/dashboard/MemoryVisualization";

export default async function MemoryPage() {
  let decisions = null;
  let dashboard = null;
  let mongoStats = null;

  try {
    [decisions, dashboard, mongoStats] = await Promise.all([
      decisionsApi.list({ pageSize: 20 }),
      dashboardApi.getState(),
      dashboardApi.getMongoStats().catch(() => ({ stats: { decisions: 0, actions: 0, states: 0, logs: 0 } })),
    ]);
  } catch {
    // Render with empty state
  }

  return (
    <div className="min-h-full bg-surface">
      {/* ─── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/[0.05] bg-gradient-to-br from-surface-1 via-surface to-surface">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-accent/5 blur-3xl rounded-full" />

        <div className="relative p-8 pb-6">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-text-primary">Organizational</span>{" "}
              <span className="gradient-text">Memory</span>
            </h1>
            <p className="text-base text-text-muted mt-2 max-w-2xl font-medium">
              A high-dimensional representation of past investigations, providing the agent with historical context for future reasoning.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-full">
                <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Memory Bank Active</span>
             </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <MemoryVisualization
          decisions={decisions?.decisions ?? []}
          operationalState={dashboard?.operationalState ?? null}
          totalDecisions={decisions?.pagination.total ?? 0}
          mongoStats={mongoStats?.stats ?? null}
        />
      </div>
    </div>
  );
}

