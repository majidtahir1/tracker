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
  BAR_CATEGORY_GAP,
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";

export default function RecoveryPerformanceChart({
  data,
}: {
  data: { week: string; recovery: number | null; volume: number }[];
}) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ ...CHART_MARGIN, right: 4 }} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="week" {...ct.axisProps} />
        <YAxis
          yAxisId="volume"
          {...ct.axisProps}
          width={44}
          tickCount={4}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <YAxis yAxisId="recovery" orientation="right" {...ct.axisProps} width={30} domain={[0, 100]} tickCount={4} />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v, name) =>
                name === "Volume" ? `${Number(v).toLocaleString("en-US")} lb` : `${v} / 100`
              }
            />
          }
          cursor={{ fill: ct.surface2, opacity: 0.5 }}
        />
        <Bar yAxisId="volume" dataKey="volume" name="Volume" {...ct.barProps(ct.colors.volt)} fillOpacity={0.8} />
        <Line
          yAxisId="recovery"
          dataKey="recovery"
          name="Recovery"
          connectNulls
          {...ct.lineProps(ct.colors.teal)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
