/**
 * Memory domain types.
 * Defines the structure of OpsMind's operational memory stored in MongoDB.
 */

// ─── Operational State ────────────────────────────────────────────────────────

export interface OperationalState {
  id: string;
  snapshotAt: Date;
  metrics: BusinessMetric[];
  anomalies: DetectedAnomaly[];
  activeInvestigations: string[]; // session IDs
  lastDecisionId?: string;
  summary: string;
}

export interface BusinessMetric {
  name: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable" | "volatile";
  changePercent?: number;
  period: string;
  isAnomaly: boolean;
}

// ─── Anomaly ──────────────────────────────────────────────────────────────────

export type AnomalySeverity = "low" | "medium" | "high" | "critical";
export type AnomalyStatus =
  | "detected"
  | "investigating"
  | "resolved"
  | "dismissed";

export interface DetectedAnomaly {
  id: string;
  metric: string;
  description: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  detectedAt: Date;
  resolvedAt?: Date;
  relatedDecisionId?: string;
  evidence: string[];
}

// ─── Execution Log ────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ExecutionLog {
  id: string;
  sessionId: string;
  level: LogLevel;
  step: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  durationMs?: number;
}

// ─── Memory Entry (for vector/semantic search) ────────────────────────────────

export interface MemoryEntry {
  id: string;
  type: "decision" | "finding" | "outcome" | "pattern";
  content: string;
  embedding?: number[];
  metadata: {
    sessionId: string;
    decisionId?: string;
    category: string;
    timestamp: Date;
    tags: string[];
  };
}

// ─── Historical Pattern ───────────────────────────────────────────────────────

export interface HistoricalPattern {
  id: string;
  description: string;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  relatedDecisionIds: string[];
  outcomes: PatternOutcome[];
}

export interface PatternOutcome {
  description: string;
  wasSuccessful: boolean;
  observedAt: Date;
}
