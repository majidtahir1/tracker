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
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";
import type { RecoveryTrendPoint } from "@/lib/queries/tracking";

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function RecoveryTrendChart({ data }: { data: RecoveryTrendPoint[] }) {
  const ct = useChartTheme();
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} minTickGap={16} />
        <YAxis {...ct.axisProps} domain={[0, 100]} tickCount={5} width={32} />
        <ReferenceLine y={40} {...ct.targetLineProps} />
        <Tooltip
          cursor={ct.tooltipCursor}
          content={<ChartTooltip formatter={(v) => `${v} / 100`} />}
        />
        <Line
          dataKey="score"
          name="Score"
          connectNulls
          {...ct.lineProps(ct.colors.teal)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
