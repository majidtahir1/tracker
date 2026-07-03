"use client";

/**
 * Shared Recharts styling constants + custom tooltip (DESIGN.md §5.3).
 * Import these in every "use client" chart wrapper — never restyle inline.
 */
import type { ReactNode } from "react";

/** Chart palette, in order of use (matches --color-chart-N tokens). */
export const CHART_COLORS = {
  volt: "#A3E635", // chart-1: primary series (e1RM, volume)
  sky: "#38BDF8", // chart-2: body weight
  pink: "#F472B6", // chart-3: chest/push groups
  amber: "#FBBF24", // chart-4: back/pull groups
  indigo: "#818CF8", // chart-5: legs
  teal: "#2DD4BF", // chart-6: arms/recovery
} as const;

export const CHART_SERIES: string[] = Object.values(CHART_COLORS);

export const CHART_BG = "#0A0B0D";

/** Tight margins — the card provides the surface. */
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

/** Horizontal-only gridlines. Spread onto <CartesianGrid>. */
export const GRID_PROPS = {
  stroke: "#24272D",
  strokeDasharray: "3 6",
  vertical: false,
} as const;

/** Spread onto <XAxis>/<YAxis>: no axis/tick lines, muted 11px labels. */
export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "#666D78", fontSize: 11 },
} as const;

/** Y-axis: 4 ticks max, domain padded ~5%. */
export const Y_AXIS_PROPS = {
  ...AXIS_PROPS,
  tickCount: 4,
  domain: ["auto", "auto"] as [string, string],
} as const;

/** Spread onto <Line>: strokeWidth 2, no dots, monotone curves. */
export function lineProps(color: string) {
  return {
    stroke: color,
    strokeWidth: 2,
    dot: false,
    activeDot: { r: 4, fill: color, stroke: CHART_BG, strokeWidth: 2 },
    type: "monotone" as const,
  };
}

/** Spread onto <Bar>: rounded tops. Category gap 30% goes on the chart. */
export function barProps(color: string) {
  return { fill: color, radius: [4, 4, 0, 0] as [number, number, number, number] };
}

export const BAR_CATEGORY_GAP = "30%";

/** Gradient stops for the area under single-series primary lines (18% → 0%). */
export const AREA_GRADIENT_STOPS = { topOpacity: 0.18, bottomOpacity: 0 };

/** Tooltip cursor line. */
export const TOOLTIP_CURSOR = { stroke: "#33373F" } as const;

/** PR markers: <ReferenceDot {...PR_DOT_PROPS} />. */
export const PR_DOT_PROPS = { r: 3.5, fill: "#A3E635", stroke: CHART_BG } as const;

/** Target lines: <ReferenceLine {...TARGET_LINE_PROPS} />. */
export const TARGET_LINE_PROPS = { stroke: "#666D78", strokeDasharray: "4 4" } as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  unit?: ReactNode;
}

/**
 * Custom tooltip — pass as `content={<ChartTooltip />}` on <Tooltip>.
 * Styled per DESIGN.md: surface-2 panel, series dots, tabular values.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number | string, name?: string | number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs shadow-[var(--shadow-raise)]">
      {label != null && <div className="text-text-3">{label}</div>}
      <div className="mt-1 space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5 text-text tabular-nums">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name != null && <span className="text-text-3">{entry.name}</span>}
            <span>
              {formatter
                ? formatter(entry.value as number | string, entry.name)
                : String(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
