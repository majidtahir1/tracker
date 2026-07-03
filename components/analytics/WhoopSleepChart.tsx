"use client";

/**
 * WHOOP sleep overlay: nightly hours asleep as bars (indigo, left axis)
 * with sleep performance % as a line (sky, right axis 0-100). Naps excluded
 * upstream in lib/queries/analytics.ts.
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

export default function WhoopSleepChart({
  data,
}: {
  data: { label: string; hours: number; performancePct: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ ...CHART_MARGIN, right: 4 }}
        barCategoryGap={BAR_CATEGORY_GAP}
      >
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis yAxisId="hours" {...AXIS_PROPS} width={30} tickCount={4} />
        <YAxis
          yAxisId="pct"
          orientation="right"
          {...AXIS_PROPS}
          width={30}
          domain={[0, 100]}
          tickCount={4}
        />
        <Tooltip
          content={
            <ChartTooltip formatter={(v, name) => (name === "Sleep" ? `${v} hr` : `${v}%`)} />
          }
          cursor={{ fill: "#1D2025", opacity: 0.5 }}
        />
        <Bar
          yAxisId="hours"
          dataKey="hours"
          name="Sleep"
          {...barProps(CHART_COLORS.indigo)}
          fillOpacity={0.8}
        />
        <Line
          yAxisId="pct"
          dataKey="performancePct"
          name="Performance"
          connectNulls
          {...lineProps(CHART_COLORS.sky)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
