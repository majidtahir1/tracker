"use client";

/**
 * Shared Recharts styling constants + custom tooltip (DESIGN.md §5.3).
 * Import these in every "use client" chart wrapper — never restyle inline.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

/** Tight margins — the card provides the surface. */
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

export const BAR_CATEGORY_GAP = "30%";

/** Gradient stops for the area under single-series primary lines (18% → 0%). */
export const AREA_GRADIENT_STOPS = { topOpacity: 0.18, bottomOpacity: 0 };

const LIGHT_FALLBACK: Record<string, string> = {
  "--chart-1": "#4F46E5", "--chart-2": "#0EA5E9", "--chart-3": "#DB2777",
  "--chart-4": "#D97706", "--chart-5": "#7C3AED", "--chart-6": "#0D9488",
  "--bg": "#F7F8FA", "--text-3": "#767D86", "--text-faint": "#A3AAB2",
  "--surface-2": "#F7F8FA", "--border": "#E3E6EA", "--border-strong": "#CDD2D8",
};

function readVar(name: string): string {
  if (typeof window === "undefined") return LIGHT_FALLBACK[name] ?? "#000";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || LIGHT_FALLBACK[name] || "#000";
}

function buildChartTheme() {
  const colors = {
    volt: readVar("--chart-1"),
    sky: readVar("--chart-2"),
    pink: readVar("--chart-3"),
    amber: readVar("--chart-4"),
    indigo: readVar("--chart-5"),
    teal: readVar("--chart-6"),
  };
  const bg = readVar("--bg");
  const axisText = readVar("--text-3");
  const faint = readVar("--text-faint");
  const surface2 = readVar("--surface-2");
  const grid = readVar("--border");
  const borderStrong = readVar("--border-strong");

  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fill: axisText, fontSize: 11 },
  };

  return {
    colors,
    series: Object.values(colors),
    bg,
    axisText,
    faint,
    surface2,
    gridProps: { stroke: grid, strokeDasharray: "3 6", vertical: false as const },
    axisProps,
    yAxisProps: { ...axisProps, tickCount: 4, domain: ["auto", "auto"] as [string, string] },
    tooltipCursor: { stroke: borderStrong },
    prDotProps: { r: 3.5, fill: colors.volt, stroke: bg },
    targetLineProps: { stroke: axisText, strokeDasharray: "4 4" },
    lineProps: (color: string) => ({
      stroke: color,
      strokeWidth: 2,
      dot: false,
      activeDot: { r: 4, fill: color, stroke: bg, strokeWidth: 2 },
      type: "monotone" as const,
    }),
    barProps: (color: string) => ({
      fill: color,
      radius: [4, 4, 0, 0] as [number, number, number, number],
    }),
  };
}

export type ChartTheme = ReturnType<typeof buildChartTheme>;

/** Resolved chart colors for the active theme; recomputes on toggle. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [ct, setCt] = useState<ChartTheme>(() => buildChartTheme());
  useEffect(() => {
    setCt(buildChartTheme());
  }, [theme]);
  return ct;
}

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
