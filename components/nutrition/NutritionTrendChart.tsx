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
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  TOOLTIP_CURSOR,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";
import type { NutritionTrendPoint } from "@/lib/queries/tracking";

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function NutritionTrendChart({ data }: { data: NutritionTrendPoint[] }) {
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={24} />
        <YAxis yAxisId="cal" {...Y_AXIS_PROPS} width={44} />
        <YAxis yAxisId="pro" orientation="right" {...Y_AXIS_PROPS} width={36} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
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
          {...lineProps(CHART_COLORS.volt)}
        />
        <Line
          yAxisId="pro"
          dataKey="protein"
          name="Protein"
          connectNulls
          {...lineProps(CHART_COLORS.sky)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
