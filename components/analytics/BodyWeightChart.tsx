"use client";

/**
 * Body-weight trend: raw readings as faint dots, 7-day moving average as
 * the sky line (DESIGN.md §4.3).
 */
import {
  CartesianGrid,
  Line,
  LineChart,
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

export default function BodyWeightChart({
  data,
}: {
  data: { label: string; weight: number; ma: number | null }[];
}) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={40} domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} lb`} />}
          cursor={ct.tooltipCursor}
        />
        <Line
          dataKey="weight"
          name="Weight"
          stroke="transparent"
          strokeWidth={0}
          dot={{ r: 2.5, fill: ct.faint, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: ct.faint, stroke: ct.bg, strokeWidth: 2 }}
          type="monotone"
          isAnimationActive={false}
        />
        <Line dataKey="ma" name="7-day avg" connectNulls {...ct.lineProps(ct.colors.sky)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
