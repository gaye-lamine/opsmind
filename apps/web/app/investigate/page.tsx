import { InvestigationLauncher } from "@/components/agent/InvestigationLauncher";
import { agentApi } from "@/services/api-client/agent.api";
import { StatusDot } from "@/components/ui/StatusDot";
import { Card } from "@/components/ui/Card";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

export default async function InvestigatePage() {
  let recentSessions = null;
  try {
    recentSessions = await agentApi.listSessions(10);
  } catch {
    // Render without sessions
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
              <span className="text-text-primary">Launch an</span>{" "}
              <span className="gradient-text">Investigation</span>
            </h1>
            <p className="text-base text-text-muted mt-2 max-w-2xl font-medium">
              Describe an operational problem. The agent assembles context, decomposes the goal, executes tools, synthesizes findings, and persists a structured decision to organizational memory.
            </p>
          </div>

          {/* Pipeline legend */}
          <div className="mt-6 flex flex-wrap gap-2">
            {["Context Assembly", "Goal Decomposition", "Planning", "Tool Execution", "Synthesis", "Reflection", "Persistence"].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5 px-3 py-1 glass-card rounded-full">
                <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                  {i + 1}
                </span>
                <span className="text-[10px] font-bold text-text-secondary tracking-tight">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* ─── Investigation Launcher ────────────────────────────────────────── */}
        <InvestigationLauncher />

        {/* ─── Recent Investigations ─────────────────────────────────────────── */}
        {recentSessions && recentSessions.sessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">
                Investigation History
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                {recentSessions.total} total
              </span>
            </div>

            <div className="space-y-3">
              {recentSessions.sessions.map((session, i) => {
                const isComplete = session.status === "completed";
                const decisionHref = isComplete && session.decisionId
                  ? `/decisions/${session.decisionId}`
                  : null;

                const content = (
                  <Card
                    variant="glass"
                    padding="none"
                    hover={!!decisionHref}
                    className={`group overflow-hidden animate-slide-up stagger-${(i % 5) + 1}`}
                  >
                    <div className="flex items-stretch">
                      {/* Status bar */}
                      <div className={`w-1 transition-all duration-300 ${
                        session.status === "completed" ? "bg-success" :
                        session.status === "failed" ? "bg-danger" :
                        session.status === "running" ? "bg-accent animate-pulse" :
                        "bg-border"
                      }`} />

                      <div className="flex-1 p-4 flex items-center gap-4">
                        {/* Status + confidence */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <StatusDot status={session.status as "completed" | "failed" | "running" | "pending"} />
                          {isComplete && typeof session.confidenceScore === "number" && (
                            <ConfidenceGauge value={session.confidenceScore} size="sm" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold tracking-tight mb-1 ${
                            decisionHref ? "group-hover:text-accent transition-colors" : ""
                          } text-text-primary`}>
                            {session.goal ?? `Investigation ${session.sessionId.slice(8, 24)}`}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-text-disabled uppercase tracking-widest">
                            <span className={`font-black uppercase ${
                              session.status === "completed" ? "text-success" :
                              session.status === "failed" ? "text-danger" :
                              session.status === "running" ? "text-accent" :
                              "text-text-muted"
                            }`}>
                              {session.status}
                            </span>
                            {session.stepCount > 0 && (
                              <>
                                <span className="opacity-30">·</span>
                                <span>{session.stepCount} steps</span>
                              </>
                            )}
                            <span className="opacity-30">·</span>
                            <span>{formatRelativeTime(session.startedAt.toString())}</span>
                          </div>
                        </div>

                        {/* Arrow if linkable */}
                        {decisionHref && (
                          <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );

                return decisionHref ? (
                  <Link key={session.sessionId} href={decisionHref}>{content}</Link>
                ) : (
                  <div key={session.sessionId}>{content}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

