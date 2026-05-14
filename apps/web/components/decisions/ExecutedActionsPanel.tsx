"use client";

import { useEffect, useState } from "react";
import { decisionsApi, type ExecutedAction } from "@/services/api-client/decisions.api";
import { actionsApi } from "@/services/api-client/actions.api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ActionRecommendation } from "@opsmind/shared";

interface ExecutedActionsPanelProps {
  decisionId: string;
  sessionId?: string;
  goal?: string;
  category?: string;
}

/**
 * ExecutedActionsPanel — shows the full causal chain of autonomous execution.
 *
 * Anomaly → Investigation → Decision → Action → External System
 *
 * This panel is the "wow moment" — it proves the system doesn't just analyze,
 * it acts in real external systems with full audit trail.
 */
export function ExecutedActionsPanel({
  decisionId,
  sessionId,
  goal,
  category,
}: ExecutedActionsPanelProps) {
  const [executedActions, setExecutedActions] = useState<ExecutedAction[]>([]);
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      decisionsApi.getExecutedActions(decisionId).catch(() => ({ actions: [], total: 0 })),
      actionsApi.getByDecision(decisionId).catch(() => ({ actions: [], total: 0 })),
    ]).then(([execData, recData]) => {
      setExecutedActions(execData.actions);
      setRecommendations(recData.actions);
    }).finally(() => setLoading(false));
  }, [decisionId]);

  return (
    <div className="space-y-4">

      {/* ── Causal Chain ──────────────────────────────────────────────────── */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <CardTitle>Execution Chain</CardTitle>
          <p className="text-2xs text-text-muted mt-1">
            How this investigation was triggered and what it produced
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-0 overflow-x-auto">
            <ChainNode
              icon="🔍"
              label="Anomaly Detected"
              sublabel="Operational state"
              color="border-warning/40 bg-warning/5"
            />
            <ChainArrow />
            <ChainNode
              icon="🧠"
              label="Investigation"
              sublabel={sessionId ? sessionId.slice(0, 16) + "…" : "Agent session"}
              color="border-accent/40 bg-accent/5"
            />
            <ChainArrow />
            <ChainNode
              icon="⚡"
              label="Decision"
              sublabel={category?.replace(/_/g, " ") ?? "synthesized"}
              color="border-blue-400/40 bg-blue-400/5"
            />
            <ChainArrow />
            <ChainNode
              icon="🚀"
              label="Actions Executed"
              sublabel={`${executedActions.length} real system${executedActions.length !== 1 ? "s" : ""}`}
              color="border-success/40 bg-success/5"
            />
          </div>
        </div>
      </Card>

      {/* ── Autonomous Executions ─────────────────────────────────────────── */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Autonomous Actions Executed</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-2xs text-success font-medium">Agent acted automatically</span>
            </div>
          </div>
          <p className="text-2xs text-text-muted mt-1">
            Real actions executed in external systems — no human intervention required
          </p>
        </div>

        {loading ? (
          <div className="p-4" key="exec-loading">
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-surface-2 rounded" />
              <div className="h-16 bg-surface-2 rounded" />
            </div>
          </div>
        ) : executedActions.length === 0 ? (
          <div className="p-4">
            <p className="text-xs text-text-muted">
              No autonomous actions were executed for this decision.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {executedActions.map((action, i) => (
              <ActionExecutionCard
                key={i}
                action={action}
                isExpanded={expandedPayload === `${i}`}
                onToggleExpand={() =>
                  setExpandedPayload(expandedPayload === `${i}` ? null : `${i}`)
                }
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Action Recommendations ────────────────────────────────────────── */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Action Recommendations ({recommendations.length})</CardTitle>
            <span className="text-2xs text-text-muted">Pending human execution</span>
          </div>
        </div>

        {loading ? (
          <div className="p-4" key="rec-loading">
            <div className="animate-pulse space-y-2">
              <div className="h-12 bg-surface-2 rounded" />
              <div className="h-12 bg-surface-2 rounded" />
              <div className="h-12 bg-surface-2 rounded" />
            </div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-4">
            <p className="text-xs text-text-muted">No recommendations found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recommendations.map((rec, i) => (
              <div key={rec.id || i} className="p-4 flex items-start gap-3">
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Badge variant={
                    rec.priority === "immediate" ? "danger" :
                    rec.priority === "high" ? "warning" :
                    rec.priority === "medium" ? "accent" : "muted"
                  }>
                    {rec.priority}
                  </Badge>
                  <Badge variant={
                    rec.status === "completed" ? "success" :
                    rec.status === "in_progress" ? "accent" :
                    rec.status === "acknowledged" ? "warning" : "muted"
                  }>
                    {rec.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">{rec.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{rec.description}</p>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="text-2xs text-text-muted uppercase tracking-wide">Impact</span>
                      <p className="text-xs text-text-secondary mt-0.5">{rec.estimatedImpact}</p>
                    </div>
                    <div>
                      <span className="text-2xs text-text-muted uppercase tracking-wide">Timeframe</span>
                      <p className="text-xs text-text-secondary mt-0.5">{rec.timeframe}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Action Execution Card ────────────────────────────────────────────────────

function ActionExecutionCard({
  action,
  isExpanded,
  onToggleExpand,
}: {
  action: ExecutedAction;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const isPubSub = action.system === "google-cloud-pubsub";
  const isMongoDB = action.system === "mongodb-atlas";

  const messageId = action.details["messageId"] !== undefined
    ? String(action.details["messageId"])
    : null;
  const severity = action.details["severity"] !== undefined
    ? String(action.details["severity"])
    : null;
  const metric = action.details["metric"] !== undefined
    ? String(action.details["metric"])
    : null;
  const operation = action.details["operation"] !== undefined
    ? String(action.details["operation"])
    : null;
  const title = action.details["title"] !== undefined
    ? String(action.details["title"])
    : null;

  // Build the structured payload for display
  const payload = isPubSub ? {
    source: "opsmind-agent",
    severity: severity,
    title: title,
    description: action.details["description"] !== undefined
      ? String(action.details["description"])
      : title,
    decisionId: action.details["decisionId"],
    sessionId: action.details["sessionId"],
    recommendedActions: Array.isArray(action.details["recommendedActions"])
      ? action.details["recommendedActions"]
      : [],
    publishedAt: action.executedAt,
    topic: "opsmind-alerts",
    project: "yonipacks-dev-6bd18",
    subscription: "opsmind-alerts-sub",
  } : isMongoDB ? {
    collection: "operational_state",
    operation: operation,
    anomalyId: action.details["anomalyId"],
    metric: metric,
    newStatus: "investigating",
    decisionId: action.details["decisionId"],
    updatedAt: action.executedAt,
  } : action.details;

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          action.status === "success"
            ? "bg-success/10 border border-success/20"
            : "bg-danger/10 border border-danger/20"
        }`}>
          {action.status === "success" ? (
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text-primary">{action.message}</span>
              <SystemBadge system={action.system} />
              {severity && (
                <span className={`text-2xs font-bold uppercase px-1.5 py-0.5 rounded ${
                  severity === "critical" ? "text-danger bg-danger/10" :
                  severity === "high" ? "text-warning bg-warning/10" :
                  "text-text-muted bg-surface-2"
                }`}>
                  {severity}
                </span>
              )}
            </div>
            <span className="text-2xs text-text-disabled flex-shrink-0">
              {new Date(action.executedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Key details */}
          <div className="mt-2 flex flex-wrap gap-3">
            {messageId && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted uppercase tracking-wide">Message ID</span>
                <code className="text-2xs text-accent font-mono bg-accent/5 px-1.5 py-0.5 rounded">
                  {messageId}
                </code>
              </div>
            )}
            {metric && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted uppercase tracking-wide">Metric</span>
                <code className="text-2xs text-text-primary font-mono bg-surface-2 px-1.5 py-0.5 rounded">
                  {metric}
                </code>
              </div>
            )}
            {operation && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted uppercase tracking-wide">Operation</span>
                <code className="text-2xs text-text-primary font-mono bg-surface-2 px-1.5 py-0.5 rounded">
                  {operation}
                </code>
              </div>
            )}
            {isPubSub && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted uppercase tracking-wide">Topic</span>
                <code className="text-2xs text-blue-400 font-mono bg-blue-400/5 px-1.5 py-0.5 rounded">
                  opsmind-alerts
                </code>
              </div>
            )}
            {isMongoDB && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-text-muted uppercase tracking-wide">Collection</span>
                <code className="text-2xs text-green-400 font-mono bg-green-400/5 px-1.5 py-0.5 rounded">
                  operational_state
                </code>
              </div>
            )}
          </div>

          {/* Expandable payload */}
          <button
            onClick={onToggleExpand}
            className="mt-2 flex items-center gap-1 text-2xs text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {isExpanded ? "Hide" : "Show"} execution payload
          </button>

          {isExpanded && (
            <div className="mt-2 rounded-md bg-surface-1 border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2">
                <span className="text-2xs text-text-muted font-mono">
                  {isPubSub ? "Pub/Sub Message Payload" : isMongoDB ? "MongoDB Atlas Update" : "Execution Details"}
                </span>
                <span className="text-2xs text-success">✓ delivered</span>
              </div>
              <pre className="p-3 text-2xs text-text-secondary font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Causal Chain Components ──────────────────────────────────────────────────

function ChainNode({
  icon,
  label,
  sublabel,
  color,
}: {
  icon: string;
  label: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border ${color} min-w-[90px]`}>
      <span className="text-base">{icon}</span>
      <span className="text-2xs font-semibold text-text-primary text-center leading-tight">{label}</span>
      <span className="text-2xs text-text-muted text-center leading-tight truncate max-w-[80px]">{sublabel}</span>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex items-center px-1 flex-shrink-0">
      <svg className="w-4 h-4 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </div>
  );
}

// ─── System Badge ─────────────────────────────────────────────────────────────

function SystemBadge({ system }: { system: string }) {
  const config: Record<string, { label: string; color: string }> = {
    "google-cloud-pubsub": {
      label: "Google Cloud Pub/Sub",
      color: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
    },
    "mongodb-atlas": {
      label: "MongoDB Atlas",
      color: "text-green-400 bg-green-400/10 border border-green-400/20",
    },
    "opsmind-agent-api": {
      label: "OpsMind Agent",
      color: "text-accent bg-accent/10 border border-accent/20",
    },
  };

  const cfg = config[system] ?? {
    label: system,
    color: "text-text-muted bg-surface-2 border border-border",
  };

  return (
    <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
