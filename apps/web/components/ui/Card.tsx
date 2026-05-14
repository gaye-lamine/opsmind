import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "glass" | "outline";
  hover?: boolean;
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantClasses = {
  default: "op-card",
  glass: "glass-card",
  outline: "bg-transparent border border-border",
};

export function Card({ 
  children, 
  className, 
  padding = "md", 
  variant = "default",
  hover = false
}: CardProps) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        hover && (variant === "glass" ? "glass-card-hover" : "transition-all duration-300 hover:border-accent-muted hover:bg-surface-3"),
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4 px-1", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-xs font-bold text-text-muted uppercase tracking-widest", className)}>
      {children}
    </h3>
  );
}

