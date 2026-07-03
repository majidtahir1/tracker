"use client";

/** 14-day recovery-score trend (teal — chart-6 is the recovery series). */
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  TARGET_LINE_PROPS,
  TOOLTIP_CURSOR,
} from "@/components/charts/ChartTheme";
import type { RecoveryTrendPoint } from "@/lib/queries/tracking";

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function RecoveryTrendChart({ data }: { data: RecoveryTrendPoint[] }) {
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} domain={[0, 100]} tickCount={5} width={32} />
        <ReferenceLine y={40} {...TARGET_LINE_PROPS} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          content={<ChartTooltip formatter={(v) => `${v} / 100`} />}
        />
        <Line
          dataKey="score"
          name="Score"
          connectNulls
          {...lineProps(CHART_COLORS.teal)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
