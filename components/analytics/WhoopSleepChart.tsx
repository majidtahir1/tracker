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
  BAR_CATEGORY_GAP,
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";

export default function WhoopSleepChart({
  data,
}: {
  data: { label: string; hours: number; performancePct: number | null }[];
}) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ ...CHART_MARGIN, right: 4 }}
        barCategoryGap={BAR_CATEGORY_GAP}
      >
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis yAxisId="hours" {...ct.axisProps} width={30} tickCount={4} />
        <YAxis
          yAxisId="pct"
          orientation="right"
          {...ct.axisProps}
          width={30}
          domain={[0, 100]}
          tickCount={4}
        />
        <Tooltip
          content={
            <ChartTooltip formatter={(v, name) => (name === "Sleep" ? `${v} hr` : `${v}%`)} />
          }
          cursor={{ fill: ct.surface2, opacity: 0.5 }}
        />
        <Bar
          yAxisId="hours"
          dataKey="hours"
          name="Sleep"
          {...ct.barProps(ct.colors.indigo)}
          fillOpacity={0.8}
        />
        <Line
          yAxisId="pct"
          dataKey="performancePct"
          name="Performance"
          connectNulls
          {...ct.lineProps(ct.colors.sky)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
