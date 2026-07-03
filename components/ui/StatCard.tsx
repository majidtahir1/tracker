import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export type TrendDirection = "up" | "down" | "neutral";

/**
 * Dashboard hero stat card (DESIGN.md §3.1).
 * `trendGood` marks whether the trend direction is a positive outcome
 * (e.g. weight up on a bulk = good; body-fat up = bad).
 */
export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  valueClassName = "text-text",
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: LucideIcon;
  trend?: { direction: TrendDirection; label: string; good?: boolean };
  /** Override for colored values (e.g. recovery score bands). */
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-card)] hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-3">{label}</span>
        {Icon && <Icon className="size-4 text-text-3" strokeWidth={2} />}
      </div>
      <div
        className={`mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums ${valueClassName}`}
      >
        {value}
        {unit && <span className="ml-1 text-base font-normal text-text-3">{unit}</span>}
      </div>
      {trend && (
        <div
          className={`mt-1.5 flex items-center gap-1 text-xs tabular-nums ${
            trend.direction === "neutral"
              ? "text-text-3"
              : trend.good !== false
                ? "text-success"
                : "text-danger"
          }`}
        >
          {trend.direction === "up" && <TrendingUp className="size-3.5" strokeWidth={2} />}
          {trend.direction === "down" && <TrendingDown className="size-3.5" strokeWidth={2} />}
          {trend.direction === "neutral" && <Minus className="size-3.5" strokeWidth={2} />}
          {trend.label}
        </div>
      )}
    </div>
  );
}
