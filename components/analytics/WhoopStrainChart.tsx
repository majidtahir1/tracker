"use client";

/** WHOOP daily strain trend line (amber, 0-21 scale). */
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

export default function WhoopStrainChart({
  data,
}: {
  data: { label: string; strain: number }[];
}) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.axisProps} width={30} domain={[0, 21]} tickCount={4} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} strain`} />}
          cursor={ct.tooltipCursor}
        />
        <Line dataKey="strain" name="Strain" {...ct.lineProps(ct.colors.amber)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
