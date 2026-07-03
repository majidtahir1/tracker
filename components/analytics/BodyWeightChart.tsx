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
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  TOOLTIP_CURSOR,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";

export default function BodyWeightChart({
  data,
}: {
  data: { label: string; weight: number; ma: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={40} domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} lb`} />}
          cursor={TOOLTIP_CURSOR}
        />
        <Line
          dataKey="weight"
          name="Weight"
          stroke="transparent"
          strokeWidth={0}
          dot={{ r: 2.5, fill: "#43484F", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "#43484F", stroke: "#0A0B0D", strokeWidth: 2 }}
          type="monotone"
          isAnimationActive={false}
        />
        <Line dataKey="ma" name="7-day avg" connectNulls {...lineProps(CHART_COLORS.sky)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
