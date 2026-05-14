/**
 * Frontend-specific types for apps/web.
 * These extend or adapt the shared types for UI rendering needs.
 */

export type SeverityLevel = "info" | "warning" | "critical";
export type PriorityLevel = "low" | "medium" | "high" | "immediate";
export type ConfidenceLevel = "low" | "medium" | "high" | "very_high";
export type StatusVariant = "active" | "completed" | "failed" | "pending" | "reflecting";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  durationMs?: number;
}
