import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * Chart Card wrapper (DESIGN.md §3.5): Section Card shell with chart-bleed
 * body padding. Put a "use client" Recharts wrapper inside `children`.
 * Heights: h-64 on dashboard grids, h-80 on Analytics — pass via `height`.
 */
export default function ChartCard({
  title,
  action,
  legend,
  height = "h-64",
  className = "",
  children,
}: {
  title: string;
  /** Header-right slot: range toggle, "View all →", etc. */
  action?: ReactNode;
  /** Optional legend row rendered above the chart. */
  legend?: Array<{ label: string; colorVar: string }>;
  height?: "h-64" | "h-80" | "h-40";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between border-b border-border-faint px-5 py-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {action}
      </div>
      <div className="px-2 pb-4 pt-4">
        {legend && (
          <div className="flex gap-4 px-3 pb-2 text-xs text-text-3">
            {legend.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: `var(${item.colorVar})` }}
                />
                {item.label}
              </span>
            ))}
          </div>
        )}
        <div className={height}>{children}</div>
      </div>
    </Card>
  );
}
