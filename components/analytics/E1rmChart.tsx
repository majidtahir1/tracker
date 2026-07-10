"use client";

/**
 * e1RM progress line for one exercise — volt area line, PR points marked
 * with accent dots + Trophy tooltip note (DESIGN.md §4.3 / §5.3).
 */
import { Trophy } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AREA_GRADIENT_STOPS,
  CHART_MARGIN,
  useChartTheme,
  type ChartTheme,
} from "@/components/charts/ChartTheme";
import type { E1rmPoint } from "@/lib/queries/analytics";

/**
 * Resolves a "--color-chart-N" CSS var name to the matching resolved hex
 * from the active chart theme (ct.series is ordered chart-1..chart-6).
 */
function resolveColorVar(colorVar: string, ct: ChartTheme): string {
  const match = colorVar.match(/chart-(\d+)/);
  const idx = match ? Number(match[1]) - 1 : 0;
  return ct.series[idx] ?? ct.colors.volt;
}

function E1rmTooltip({
  active,
  payload,
  dotColor,
}: {
  active?: boolean;
  payload?: Array<{ payload?: E1rmPoint }>;
  dotColor: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs shadow-[var(--shadow-raise)]">
      <div className="text-text-3">{point.label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-text tabular-nums">
        <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <span>{point.e1rm} lb e1RM</span>
      </div>
      <div className="mt-0.5 text-text-3 tabular-nums">top set {point.topSet}</div>
      {point.isPr && (
        <div className="mt-0.5 flex items-center gap-1 font-semibold text-accent">
          <Trophy className="size-3" strokeWidth={2} /> PR session
        </div>
      )}
    </div>
  );
}

/**
 * `colorVar` is a "--color-chart-N" CSS custom-property name (see
 * app/analytics/page.tsx's BIG_FOUR_COLORS / VOLUME_LEGEND colorVar
 * pattern) — resolved here to a literal hex via the chart theme, since
 * this is the client component in the tree that can call useChartTheme().
 */
export default function E1rmChart({
  series,
  colorVar = "--color-chart-1",
}: {
  series: E1rmPoint[];
  colorVar?: string;
}) {
  const ct = useChartTheme();
  const color = resolveColorVar(colorVar, ct);
  const gradientId = `e1rm-fill-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={AREA_GRADIENT_STOPS.topOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={AREA_GRADIENT_STOPS.bottomOpacity} />
          </linearGradient>
        </defs>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={40} />
        <Tooltip content={<E1rmTooltip dotColor={color} />} cursor={ct.tooltipCursor} />
        <Area
          type="monotone"
          dataKey="e1rm"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: ct.bg, strokeWidth: 2 }}
        />
        {series
          .filter((p) => p.isPr)
          .map((p) => (
            <ReferenceDot key={p.date} x={p.label} y={p.e1rm} {...ct.prDotProps} />
          ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
