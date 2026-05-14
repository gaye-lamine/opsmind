/**
 * Decision domain types.
 * A Decision is the primary output artifact of the OpsMind reasoning pipeline.
 */

// ─── Decision ─────────────────────────────────────────────────────────────────

export type DecisionStatus =
  | "draft"
  | "pending_reflection"
  | "reflected"
  | "finalized"
  | "superseded";

export type DecisionCategory =
  | "anomaly_resolution"
  | "strategic_recommendation"
  | "operational_action"
  | "risk_mitigation"
  | "performance_optimization"
  | "monitoring_alert";

export type ConfidenceLevel = "low" | "medium" | "high" | "very_high";

export interface Decision {
  id: string;
  sessionId: string;
  goal: string;
  category: DecisionCategory;
  status: DecisionStatus;

  // Core content
  summary: string;
  reasoning: string;
  findings: Finding[];
  recommendations: ActionRecommendation[];

  // Reflection output
  reflection?: DecisionReflection;

  // Confidence
  confidenceScore: number; // 0–1
  confidenceLevel: ConfidenceLevel;

  // Traceability
  reasoningTrace: ReasoningTrace;
  toolsUsed: string[];
  memoryReferences: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─── Finding ──────────────────────────────────────────────────────────────────

export type FindingSeverity = "info" | "warning" | "critical";

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  evidence: string[];
  relatedMetrics?: string[];
}

// ─── Action Recommendation ────────────────────────────────────────────────────

export type ActionPriority = "low" | "medium" | "high" | "immediate";
export type ActionStatus =
  | "recommended"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "dismissed";

export interface ActionRecommendation {
  id: string;
  title: string;
  description: string;
  rationale: string;
  priority: ActionPriority;
  status: ActionStatus;
  estimatedImpact: string;
  timeframe: string;
  risks?: string[];
}

// ─── Decision Reflection ──────────────────────────────────────────────────────

export interface DecisionReflection {
  confidenceAssessment: string;
  reasoningQuality: string;
  identifiedRisks: string[];
  alternativeApproaches: string[];
  limitations: string[];
  improvementSuggestions: string[];
  overallScore: number; // 0–1
}

// ─── Reasoning Trace ──────────────────────────────────────────────────────────

export interface ReasoningTrace {
  steps: ReasoningTraceStep[];
  totalDurationMs: number;
  modelUsed: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ReasoningTraceStep {
  step: string;
  input: string;
  output: string;
  durationMs: number;
  timestamp: Date;
}
