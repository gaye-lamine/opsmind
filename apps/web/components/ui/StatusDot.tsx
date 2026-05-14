import { cn } from "@/lib/utils";

type Status =
  | "active"
  | "running"
  | "reflecting"
  | "completed"
  | "failed"
  | "timeout"
  | "pending"
  | "initializing";

const statusClasses: Record<Status, string> = {
  active: "status-dot-active",
  running: "status-dot-active",
  initializing: "status-dot-active",
  reflecting: "status-dot-reflecting",
  completed: "status-dot-completed",
  failed: "status-dot-failed",
  timeout: "status-dot-failed",
  pending: "status-dot-pending",
};

interface StatusDotProps {
  status: Status;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span className={cn(statusClasses[status] ?? "status-dot bg-text-muted", className)} />
  );
}
