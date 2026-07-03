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
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  GRID_PROPS,
  PR_DOT_PROPS,
  TOOLTIP_CURSOR,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";
import type { E1rmPoint } from "@/lib/queries/analytics";

function E1rmTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: E1rmPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs shadow-[var(--shadow-raise)]">
      <div className="text-text-3">{point.label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-text tabular-nums">
        <span className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.volt }} />
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

export default function E1rmChart({ series, color = CHART_COLORS.volt }: { series: E1rmPoint[]; color?: string }) {
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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={40} />
        <Tooltip content={<E1rmTooltip />} cursor={TOOLTIP_CURSOR} />
        <Area
          type="monotone"
          dataKey="e1rm"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "#0A0B0D", strokeWidth: 2 }}
        />
        {series
          .filter((p) => p.isPr)
          .map((p) => (
            <ReferenceDot key={p.date} x={p.label} y={p.e1rm} {...PR_DOT_PROPS} />
          ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
