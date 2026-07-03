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
  AXIS_PROPS,
  BAR_CATEGORY_GAP,
  CHART_COLORS,
  CHART_MARGIN,
  ChartTooltip,
  GRID_PROPS,
  lineProps,
  barProps,
  TARGET_LINE_PROPS,
  TOOLTIP_CURSOR,
  Y_AXIS_PROPS,
} from "@/components/charts/ChartTheme";
import type {
  BodyWeightPoint,
  ConsistencyPoint,
  E1rmPoint,
  FrequencyPoint,
  MuscleVolumePoint,
  WeeklyVolumePoint,
} from "@/lib/queries/dashboard";

function ChartEmpty({ title, body }: { title: string; body: string }) {
  return <EmptyState chart icon={ChartLine} title={title} body={body} />;
}

const fmtLb = (v: number | string) => `${Number(v).toLocaleString("en-US")} lb`;

// ---------- Body weight (chart-2, area gradient) ----------

export function BodyWeightChart({ data }: { data: BodyWeightPoint[] }) {
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
            <stop offset="0%" stopColor={CHART_COLORS.sky} stopOpacity={AREA_GRADIENT_STOPS.topOpacity} />
            <stop offset="100%" stopColor={CHART_COLORS.sky} stopOpacity={AREA_GRADIENT_STOPS.bottomOpacity} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={40} />
        <Tooltip cursor={TOOLTIP_CURSOR} content={<ChartTooltip formatter={fmtLb} />} />
        <Area
          {...lineProps(CHART_COLORS.sky)}
          dataKey="weight"
          name="Weight"
          fill="url(#bw-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- Big-4 e1RM multi-line ----------

const E1RM_SERIES: Array<{ key: keyof Omit<E1rmPoint, "label">; name: string; color: string }> = [
  { key: "bench", name: "Bench", color: CHART_COLORS.volt },
  { key: "squat", name: "Squat", color: CHART_COLORS.pink },
  { key: "rdl", name: "RDL", color: CHART_COLORS.amber },
  { key: "ohp", name: "OHP", color: CHART_COLORS.indigo },
];

export function E1rmChart({ data }: { data: E1rmPoint[] }) {
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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={40} />
        <Tooltip cursor={TOOLTIP_CURSOR} content={<ChartTooltip formatter={fmtLb} />} />
        {E1RM_SERIES.map((s) => (
          <Line key={s.key} {...lineProps(s.color)} dataKey={s.key} name={s.name} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Weekly volume bars (chart-1) ----------

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={48} />
        <Tooltip cursor={TOOLTIP_CURSOR} content={<ChartTooltip formatter={fmtLb} />} />
        <Bar {...barProps(CHART_COLORS.volt)} dataKey="volume" name="Volume" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Muscle-group sets vs weekly targets ----------

export function MuscleVolumeChart({ data }: { data: MuscleVolumePoint[] }) {
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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval={0} tick={{ ...AXIS_PROPS.tick, fontSize: 9 }} />
        <YAxis {...Y_AXIS_PROPS} width={28} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          content={<ChartTooltip formatter={(v) => `${v} sets`} />}
        />
        <Bar
          dataKey="target"
          name="Target"
          fill="transparent"
          stroke={TARGET_LINE_PROPS.stroke}
          strokeDasharray={TARGET_LINE_PROPS.strokeDasharray}
          radius={[4, 4, 0, 0]}
        />
        <Bar {...barProps(CHART_COLORS.volt)} dataKey="actual" name="Actual" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Workout frequency (sessions per week, target 4) ----------

export function FrequencyChart({ data }: { data: FrequencyPoint[] }) {
  if (data.length === 0) {
    return (
      <ChartEmpty
        title="No sessions yet."
        body="The program schedules 4 sessions a week — completions land here."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} barCategoryGap={BAR_CATEGORY_GAP}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={28} domain={[0, 5]} allowDecimals={false} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          content={<ChartTooltip formatter={(v) => `${v} sessions`} />}
        />
        <ReferenceLine y={4} {...TARGET_LINE_PROPS} />
        <Bar {...barProps(CHART_COLORS.teal)} dataKey="sessions" name="Sessions" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Consistency (% of scheduled sessions completed, target 90) ----------

export function ConsistencyChart({ data }: { data: ConsistencyPoint[] }) {
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
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...Y_AXIS_PROPS} width={34} domain={[0, 100]} />
        <Tooltip
          cursor={TOOLTIP_CURSOR}
          content={<ChartTooltip formatter={(v) => `${v}%`} />}
        />
        <ReferenceLine y={90} {...TARGET_LINE_PROPS} />
        <Line {...lineProps(CHART_COLORS.volt)} dataKey="pct" name="Consistency" />
      </LineChart>
    </ResponsiveContainer>
  );
}
