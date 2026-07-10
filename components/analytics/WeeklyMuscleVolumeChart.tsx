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
  BAR_CATEGORY_GAP,
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";
import type { WeeklyRegionRow } from "@/lib/queries/analytics";

const REGIONS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"] as const;

export default function WeeklyMuscleVolumeChart({
  data,
  targetTotal,
}: {
  data: WeeklyRegionRow[];
  targetTotal: number;
}) {
  const ct = useChartTheme();
  /** Region → chart color (chest/push pink, back/pull amber, legs indigo, arms teal). */
  const REGION_COLORS: Record<string, string> = {
    Chest: ct.colors.pink,
    Back: ct.colors.amber,
    Shoulders: ct.colors.sky,
    Arms: ct.colors.teal,
    Legs: ct.colors.indigo,
    Core: ct.colors.volt,
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="week" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={36} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} sets`} />}
          cursor={{ fill: ct.surface2, opacity: 0.5 }}
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
          {...ct.targetLineProps}
          label={{ value: "target", position: "insideTopRight", fill: ct.axisText, fontSize: 11 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
