"use client";

/**
 * Weekly working sets stacked by body region, with the program's total
 * weekly set target as a dashed reference line (DESIGN.md §5.3).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  BAR_CATEGORY_GAP,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  TARGET_LINE_PROPS,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";
import type { WeeklyRegionRow } from "@/lib/queries/analytics";

/** Region → chart color (chest/push pink, back/pull amber, legs indigo, arms teal). */
export const REGION_COLORS: Record<string, string> = {
  Chest: CHART_COLORS.pink,
  Back: CHART_COLORS.amber,
  Shoulders: CHART_COLORS.sky,
  Arms: CHART_COLORS.teal,
  Legs: CHART_COLORS.indigo,
  Core: CHART_COLORS.volt,
};

const REGIONS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"] as const;

export default function WeeklyMuscleVolumeChart({
  data,
  targetTotal,
}: {
  data: WeeklyRegionRow[];
  targetTotal: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="week" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={36} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} sets`} />}
          cursor={{ fill: "#1D2025", opacity: 0.5 }}
        />
        {REGIONS.map((region, i) => (
          <Bar
            key={region}
            dataKey={region}
            stackId="sets"
            fill={REGION_COLORS[region]}
            radius={i === REGIONS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
        <ReferenceLine
          y={targetTotal}
          {...TARGET_LINE_PROPS}
          label={{ value: "target", position: "insideTopRight", fill: "#666D78", fontSize: 11 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
