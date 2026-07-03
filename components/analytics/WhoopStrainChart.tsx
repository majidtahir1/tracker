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
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  TOOLTIP_CURSOR,
} from "@/components/charts/ChartTheme";

export default function WhoopStrainChart({
  data,
}: {
  data: { label: string; strain: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={30} domain={[0, 21]} tickCount={4} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} strain`} />}
          cursor={TOOLTIP_CURSOR}
        />
        <Line dataKey="strain" name="Strain" {...lineProps(CHART_COLORS.amber)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
