import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-3 text-text-secondary border-border",
  success: "bg-success-subtle text-success border-success-muted",
  warning: "bg-warning-subtle text-warning border-warning-muted",
  danger: "bg-danger-subtle text-danger border-danger-muted",
  accent: "bg-accent-subtle text-accent border-accent-muted",
  muted: "bg-surface-2 text-text-muted border-border-subtle",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium border uppercase tracking-wide",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
