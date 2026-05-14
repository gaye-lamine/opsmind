/**
 * UI utility functions.
 */

/** Merges class names — lightweight alternative to clsx for this project */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Formats a confidence score (0–1) as a percentage string */
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Formats a duration in ms to a human-readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/** Formats an ISO date string to a relative time label */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Formats an ISO date string to a full timestamp */
export function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Truncates a string to a max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

/** Maps a confidence level to a color class */
export function confidenceLevelColor(level: string): string {
  const map: Record<string, string> = {
    very_high: "text-success",
    high: "text-success",
    medium: "text-warning",
    low: "text-danger",
  };
  return map[level] ?? "text-text-secondary";
}

/** Maps a severity to a color class */
export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: "text-danger",
    warning: "text-warning",
    info: "text-text-secondary",
  };
  return map[severity] ?? "text-text-secondary";
}

/** Maps a priority to a color class */
export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    immediate: "text-danger",
    high: "text-warning",
    medium: "text-accent",
    low: "text-text-secondary",
  };
  return map[priority] ?? "text-text-secondary";
}
