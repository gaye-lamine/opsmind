"use client";

import { cn } from "@/lib/utils";

interface ConfidenceGaugeProps {
  value: number; // 0–1
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { svg: 32, stroke: 3, fontSize: "text-2xs", r: 12 },
  md: { svg: 48, stroke: 3.5, fontSize: "text-xs", r: 18 },
  lg: { svg: 72, stroke: 4, fontSize: "text-sm", r: 28 },
};

function getColor(value: number): { stroke: string; text: string; glow: string } {
  if (value >= 0.8) return { stroke: "#10b981", text: "text-success", glow: "rgba(16,185,129,0.3)" };
  if (value >= 0.6) return { stroke: "#f59e0b", text: "text-warning", glow: "rgba(245,158,11,0.3)" };
  return { stroke: "#ef4444", text: "text-danger", glow: "rgba(239,68,68,0.3)" };
}

/**
 * Animated radial confidence gauge.
 * Color-coded: green (≥0.8), amber (0.6–0.8), red (<0.6).
 */
export function ConfidenceGauge({
  value,
  size = "md",
  showLabel = true,
  className,
}: ConfidenceGaugeProps) {
  const config = SIZE_MAP[size];
  const circumference = 2 * Math.PI * config.r;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 1));
  const color = getColor(value);
  const percent = Math.round(value * 100);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={config.svg}
        height={config.svg}
        viewBox={`0 0 ${config.svg} ${config.svg}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={config.svg / 2}
          cy={config.svg / 2}
          r={config.r}
          fill="none"
          stroke="rgba(30, 30, 46, 0.8)"
          strokeWidth={config.stroke}
        />
        {/* Filled arc */}
        <circle
          cx={config.svg / 2}
          cy={config.svg / 2}
          r={config.r}
          fill="none"
          stroke={color.stroke}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            "--gauge-offset": `${offset}`,
            filter: `drop-shadow(0 0 4px ${color.glow})`,
            transition: "stroke-dashoffset 1s ease-out",
          } as React.CSSProperties}
          className="animate-gauge-fill"
        />
      </svg>
      {showLabel && (
        <span
          className={cn(
            "absolute font-bold tabular-nums",
            config.fontSize,
            color.text
          )}
        >
          {percent}
        </span>
      )}
    </div>
  );
}
