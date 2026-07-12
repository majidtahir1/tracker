"use client";

/**
 * Dashboard chart bodies (DESIGN.md §3.5 + §5.3). All Recharts styling comes
 * from components/charts/ChartTheme — never inline restyles. Each chart owns
 * its DESIGN.md chart empty state.
 */
import { ChartLine } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "@/components/ui/EmptyState";
import {
  AREA_GRADIENT_STOPS,
  BAR_CATEGORY_GAP,
  CHART_MARGIN,
  ChartTooltip,
  useChartTheme,
} from "@/components/charts/ChartTheme";
import type {
  BodyWeightPoint,
  ConsistencyPoint,
  E1rmPoint,
  MuscleVolumePoint,
  WeeklyVolumePoint,
} from "@/lib/queries/dashboard";

function ChartEmpty({ title, body }: { title: string; body: string }) {
  return <EmptyState chart icon={ChartLine} title={title} body={body} />;
}

const fmtLb = (v: number | string) => `${Number(v).toLocaleString("en-US")} lb`;

// ---------- Body weight (chart-2, area gradient) ----------

export function BodyWeightChart({ data }: { data: BodyWeightPoint[] }) {
  const ct = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="No weigh-ins yet."
        body="Log a body weight in Measurements and the trend line starts here."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ct.colors.sky} stopOpacity={AREA_GRADIENT_STOPS.topOpacity} />
            <stop offset="100%" stopColor={ct.colors.sky} stopOpacity={AREA_GRADIENT_STOPS.bottomOpacity} />
          </linearGradient>
        </defs>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={40} />
        <Tooltip cursor={ct.tooltipCursor} content={<ChartTooltip formatter={fmtLb} />} />
        <Area
          {...ct.lineProps(ct.colors.sky)}
          dataKey="weight"
          name="Weight"
          fill="url(#bw-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- Big-4 e1RM multi-line ----------

export function E1rmChart({ data }: { data: E1rmPoint[] }) {
  const ct = useChartTheme();
  const E1RM_SERIES: Array<{ key: keyof Omit<E1rmPoint, "label">; name: string; color: string }> = [
    { key: "bench", name: "Bench", color: ct.colors.volt },
    { key: "squat", name: "Squat", color: ct.colors.pink },
    { key: "rdl", name: "RDL", color: ct.colors.amber },
    { key: "ohp", name: "OHP", color: ct.colors.indigo },
  ];
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="No lifts logged yet."
        body="Estimated 1RMs for Bench, Squat, RDL and OHP chart here after your first sessions."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={40} />
        <Tooltip cursor={ct.tooltipCursor} content={<ChartTooltip formatter={fmtLb} />} />
        {E1RM_SERIES.map((s) => (
          <Line key={s.key} {...ct.lineProps(s.color)} dataKey={s.key} name={s.name} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Weekly volume bars (chart-1) ----------

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
  const ct = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="No volume yet."
        body="Finish a workout and weekly tonnage stacks up here."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={48} />
        <Tooltip cursor={ct.tooltipCursor} content={<ChartTooltip formatter={fmtLb} />} />
        <Bar {...ct.barProps(ct.colors.volt)} dataKey="volume" name="Volume" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Muscle-group sets vs weekly targets ----------

export function MuscleVolumeChart({ data }: { data: MuscleVolumePoint[] }) {
  const ct = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="No sets this week."
        body="Completed sets credit each muscle group and chart against the program's weekly targets."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="20%">
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} interval={0} tick={{ ...ct.axisProps.tick, fontSize: 9 }} />
        <YAxis {...ct.yAxisProps} width={28} />
        <Tooltip
          cursor={ct.tooltipCursor}
          content={<ChartTooltip formatter={(v) => `${v} sets`} />}
        />
        <Bar
          dataKey="target"
          name="Target"
          fill="transparent"
          stroke={ct.targetLineProps.stroke}
          strokeDasharray={ct.targetLineProps.strokeDasharray}
          radius={[4, 4, 0, 0]}
        />
        <Bar {...ct.barProps(ct.colors.volt)} dataKey="actual" name="Actual" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Consistency (% of scheduled sessions completed, target 90) ----------

export function ConsistencyChart({ data }: { data: ConsistencyPoint[] }) {
  const ct = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="Nothing to measure yet."
        body="Complete sessions and weekly consistency tracks toward the 90% target."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...ct.gridProps} />
        <XAxis dataKey="label" {...ct.axisProps} />
        <YAxis {...ct.yAxisProps} width={34} domain={[0, 100]} />
        <Tooltip
          cursor={ct.tooltipCursor}
          content={<ChartTooltip formatter={(v) => `${v}%`} />}
        />
        <ReferenceLine y={90} {...ct.targetLineProps} />
        <Line {...ct.lineProps(ct.colors.volt)} dataKey="pct" name="Consistency" />
      </LineChart>
    </ResponsiveContainer>
  );
}
