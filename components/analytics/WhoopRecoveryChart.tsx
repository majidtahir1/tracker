"use client";

/**
 * WHOOP recovery vs HRV overlay: daily recovery score (teal, left axis 0-100)
 * against HRV RMSSD in ms (indigo, right axis). Series merge by date so days
 * missing one metric still plot the other.
 */
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

export default function WhoopRecoveryChart({
  recovery,
  hrv,
}: {
  recovery: { date: string; label: string; score: number }[];
  hrv: { date: string; label: string; hrvMs: number }[];
}) {
  const byDate = new Map<string, { label: string; score: number | null; hrv: number | null }>();
  for (const p of recovery) byDate.set(p.date, { label: p.label, score: p.score, hrv: null });
  for (const p of hrv) {
    const row = byDate.get(p.date);
    if (row) row.hrv = p.hrvMs;
    else byDate.set(p.date, { label: p.label, score: null, hrv: p.hrvMs });
  }
  const data = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, row]) => row);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ ...CHART_MARGIN, right: 4 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis yAxisId="score" {...AXIS_PROPS} width={30} domain={[0, 100]} tickCount={4} />
        <YAxis yAxisId="hrv" orientation="right" {...AXIS_PROPS} width={34} tickCount={4} />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v, name) => (name === "HRV" ? `${v} ms` : `${v} / 100`)}
            />
          }
          cursor={TOOLTIP_CURSOR}
        />
        <Line
          yAxisId="score"
          dataKey="score"
          name="Recovery"
          connectNulls
          {...lineProps(CHART_COLORS.teal)}
        />
        <Line
          yAxisId="hrv"
          dataKey="hrv"
          name="HRV"
          connectNulls
          {...lineProps(CHART_COLORS.indigo)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
