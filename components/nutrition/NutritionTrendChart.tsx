"use client";

/** 30-day calories (volt, left axis) + protein (sky, right axis) trend. */
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
import type { NutritionTrendPoint } from "@/lib/queries/tracking";

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function NutritionTrendChart({ data }: { data: NutritionTrendPoint[] }) {
  const ct = useChartTheme();
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} minTickGap={24} />
        <YAxis yAxisId="cal" {...ct.yAxisProps} width={44} />
        <YAxis yAxisId="pro" orientation="right" {...ct.yAxisProps} width={36} />
        <Tooltip
          cursor={ct.tooltipCursor}
          content={
            <ChartTooltip
              formatter={(v, name) =>
                name === "Protein" ? `${v} g` : `${Number(v).toLocaleString()} kcal`
              }
            />
          }
        />
        <Line
          yAxisId="cal"
          dataKey="calories"
          name="Calories"
          connectNulls
          {...ct.lineProps(ct.colors.volt)}
        />
        <Line
          yAxisId="pro"
          dataKey="protein"
          name="Protein"
          connectNulls
          {...ct.lineProps(ct.colors.sky)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
