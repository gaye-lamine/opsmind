import { dashboardApi } from "@/services/api-client/dashboard.api";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { AnomalyPanel } from "@/components/dashboard/AnomalyPanel";
import { RecentDecisions } from "@/components/dashboard/RecentDecisions";
import { PendingActionsPanel } from "@/components/dashboard/PendingActionsPanel";
import { InvestigationLauncher } from "@/components/agent/InvestigationLauncher";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";

/**
 * Dashboard page — the operational intelligence command center.
 *
 * Server Component: fetches dashboard state on the server for fast initial load.
 * Displays: metrics, anomalies, recent decisions, pending actions, investigation launcher.
 *
 * Rule §8: operational dashboard, not a chat interface.
 */
export default async function DashboardPage() {
  let dashboardState = null;
  let fetchError: string | null = null;

  try {
    dashboardState = await dashboardApi.getState();
  } catch {
    fetchError = "Unable to connect to OpsMind API. Ensure the API server is running.";
  }

  const anomalyCount = dashboardState?.activeAnomalies?.filter(
    (a) => a.status !== "resolved" && a.status !== "dismissed"
  ).length ?? 0;

  return (
    <div className="min-h-full bg-surface">
      {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/[0.05] bg-gradient-to-br from-surface-1 via-surface to-surface">
        {/* Background grid decoration */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        {/* Accent glow */}
        <div className="absolute top-0 left-1/4 w-96 h-32 bg-accent/5 blur-3xl rounded-full" />

        <div className="relative p-8 pb-6">
          <DashboardHeader
            systemHealth={dashboardState?.systemHealth ?? null}
            activeInvestigations={dashboardState?.operationalState.activeInvestigations.length ?? 0}
          />

          {/* ─── Stats Strip ────────────────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Investigations",
                value: dashboardState?.recentDecisions.length ?? 0,
                icon: "🔬",
                suffix: "",
              },
              {
                label: "Active Anomalies",
                value: anomalyCount,
                icon: "⚠️",
                suffix: anomalyCount === 1 ? " issue" : " issues",
                highlight: anomalyCount > 0,
              },
              {
                label: "Pending Actions",
                value: dashboardState?.pendingActions.length ?? 0,
                icon: "⚡",
                suffix: "",
              },
              {
                label: "Memory Entries",
                value: (dashboardState?.systemHealth as any)?.totalDecisions ?? dashboardState?.recentDecisions.length ?? 0,
                icon: "💾",
                suffix: " decisions",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass-card px-4 py-3 flex items-center gap-3"
              >
                <span className="text-xl">{stat.icon}</span>
                <div>
                  <div className={`text-2xl font-black tabular-nums tracking-tight ${stat.highlight ? "text-warning" : "text-text-primary"}`}>
                    {stat.value.toLocaleString()}{stat.suffix}
                  </div>
                  <div className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Connection error */}
        {fetchError && (
          <div className="border border-danger/30 bg-danger/5 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium text-danger">{fetchError}</p>
          </div>
        )}

        {/* ─── Investigation Launcher — primary action ─────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">New Investigation</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
          </div>
          <InvestigationLauncher />
        </div>

        {/* ─── Metrics Grid ────────────────────────────────────────────────── */}
        {dashboardState && (
          <MetricsGrid metrics={dashboardState.operationalState.metrics} />
        )}

        {/* ─── AI Analytics Insights ────────────────────────────────────────── */}
        {dashboardState && (
          <InsightsPanel insights={dashboardState.insights} />
        )}

        {/* ─── Anomalies + Pending Actions ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnomalyPanel anomalies={dashboardState?.activeAnomalies ?? []} />
          <PendingActionsPanel actions={dashboardState?.pendingActions ?? []} />
        </div>

        {/* ─── Intelligence Ledger ─────────────────────────────────────────── */}
        <RecentDecisions decisions={dashboardState?.recentDecisions ?? []} />
      </div>
    </div>
  );
}

