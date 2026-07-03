"use client";

/**
 * Recovery vs performance overlay: weekly avg recovery score (teal, left axis)
 * against weekly training volume (volt, right axis).
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  BAR_CATEGORY_GAP,
  barProps,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
} from "@/components/charts/ChartTheme";

export default function RecoveryPerformanceChart({
  data,
}: {
  data: { week: string; recovery: number | null; volume: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ ...CHART_MARGIN, right: 4 }} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="week" {...AXIS_PROPS} />
        <YAxis
          yAxisId="volume"
          {...AXIS_PROPS}
          width={44}
          tickCount={4}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <YAxis yAxisId="recovery" orientation="right" {...AXIS_PROPS} width={30} domain={[0, 100]} tickCount={4} />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v, name) =>
                name === "Volume" ? `${Number(v).toLocaleString("en-US")} lb` : `${v} / 100`
              }
            />
          }
          cursor={{ fill: "#1D2025", opacity: 0.5 }}
        />
        <Bar yAxisId="volume" dataKey="volume" name="Volume" {...barProps(CHART_COLORS.volt)} fillOpacity={0.8} />
        <Line
          yAxisId="recovery"
          dataKey="recovery"
          name="Recovery"
          connectNulls
          {...lineProps(CHART_COLORS.teal)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
