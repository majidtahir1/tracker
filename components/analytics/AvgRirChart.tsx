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
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";

export default function AvgRirChart({ data }: { data: { week: string; avgRir: number }[] }) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="week" {...ct.axisProps} />
        <YAxis
          {...ct.axisProps}
          width={30}
          tickCount={4}
          domain={[0, 3]}
          allowDecimals={false}
        />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} RIR avg`} />}
          cursor={ct.tooltipCursor}
        />
        <Line dataKey="avgRir" name="Avg RIR" {...ct.lineProps(ct.colors.teal)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
