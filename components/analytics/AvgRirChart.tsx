"use client";

/** Weekly average RIR trend line (teal). */
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
} from "@/components/charts/ChartTheme";

export default function AvgRirChart({ data }: { data: { week: string; avgRir: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="week" {...AXIS_PROPS} />
        <YAxis
          {...AXIS_PROPS}
          width={30}
          tickCount={4}
          domain={[0, 3]}
          allowDecimals={false}
        />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} RIR avg`} />}
          cursor={TOOLTIP_CURSOR}
        />
        <Line dataKey="avgRir" name="Avg RIR" {...lineProps(CHART_COLORS.teal)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
