"use client";

/**
 * Per-exercise progression chart: top working-set weight over time (volt),
 * with the e1RM trend as a second muted line when available.
 */
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AREA_GRADIENT_STOPS,
  AXIS_PROPS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  TOOLTIP_CURSOR,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";
import type { HistoryPoint } from "@/lib/queries/exercises";

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function ExerciseProgressChart({
  history,
  isBodyweight,
}: {
  history: HistoryPoint[];
  isBodyweight: boolean;
}) {
  const data = history.map((h) => ({
    ...h,
    label: shortDate(h.date),
  }));
  const hasE1rm = data.some((d) => d.e1rm != null);
  const weightName = isBodyweight ? "Added weight" : "Top set";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="exWeightFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={CHART_COLORS.volt}
              stopOpacity={AREA_GRADIENT_STOPS.topOpacity}
            />
            <stop
              offset="100%"
              stopColor={CHART_COLORS.volt}
              stopOpacity={AREA_GRADIENT_STOPS.bottomOpacity}
            />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={40} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          content={<ChartTooltip formatter={(v) => `${v} lb`} />}
        />
        {!hasE1rm && (
          <Area
            dataKey="topWeight"
            type="monotone"
            stroke="none"
            fill="url(#exWeightFill)"
            legendType="none"
            tooltipType="none"
          />
        )}
        <Line dataKey="topWeight" name={weightName} {...lineProps(CHART_COLORS.volt)} />
        {hasE1rm && (
          <Line
            dataKey="e1rm"
            name="e1RM"
            connectNulls
            {...lineProps(CHART_COLORS.teal)}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
