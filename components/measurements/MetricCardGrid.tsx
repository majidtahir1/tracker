"use client";

/**
 * Per-measurement sparkline card grid (DESIGN.md §4.5): current value stat,
 * delta badge vs previous entry, h-40 area sparkline.
 */
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  AREA_GRADIENT_STOPS,
  ChartTooltip,
  useChartTheme,
  type ChartTheme,
} from "@/components/charts/ChartTheme";
import type { MeasurementMetric } from "@/lib/queries/tracking";

const MINUS = "−";

function fmtValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? "+" : delta < 0 ? MINUS : "±";
  return `${sign}${fmtValue(Math.abs(delta))} ${unit}`;
}

function deltaVariant(metric: MeasurementMetric): BadgeVariant {
  const { delta, goodDirection } = metric;
  if (delta == null || delta === 0 || goodDirection == null) return "neutral";
  const isGood = goodDirection === "up" ? delta > 0 : delta < 0;
  return isGood ? "success" : "danger";
}

function metricColor(key: string, ct: ChartTheme): string {
  if (key === "weight") return ct.colors.sky;
  if (key === "bodyFat") return ct.colors.pink;
  return ct.colors.teal;
}

function MetricCard({ metric }: { metric: MeasurementMetric }) {
  const ct = useChartTheme();
  const color = metricColor(metric.key, ct);
  const gradientId = `metric-fill-${metric.key}`;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-3">
          {metric.label}
        </span>
        {metric.delta != null ? (
          <Badge variant={deltaVariant(metric)}>{fmtDelta(metric.delta, metric.unit)}</Badge>
        ) : (
          <Badge variant="neutral">—</Badge>
        )}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums text-text">
        {metric.current != null ? fmtValue(metric.current) : "—"}
        {metric.current != null && (
          <span className="ml-1 text-base font-normal text-text-3">{metric.unit}</span>
        )}
      </div>
      <div className="mt-3 h-20">
        {metric.points.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metric.points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={AREA_GRADIENT_STOPS.topOpacity} />
                  <stop offset="100%" stopColor={color} stopOpacity={AREA_GRADIENT_STOPS.bottomOpacity} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                cursor={ct.tooltipCursor}
                content={
                  <ChartTooltip formatter={(v) => `${fmtValue(Number(v))} ${metric.unit}`} />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                name={metric.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: ct.bg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-xs text-text-faint">
            {metric.points.length === 1
              ? "One entry — next month starts the trend."
              : "No data yet."}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MetricCardGrid({ metrics }: { metrics: MeasurementMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
      {metrics.map((m) => (
        <MetricCard key={m.key} metric={m} />
      ))}
    </div>
  );
}
