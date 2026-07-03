/**
 * WHOOP activity row for /history — read-only context alongside logged
 * sessions. Deliberately muted vs session rows: no link, no chevron, small
 * WHOOP badge, tertiary metric line.
 */
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { HistoryWhoopRow } from "@/lib/queries/workout";

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default function WhoopWorkoutCard({ workout }: { workout: HistoryWhoopRow }) {
  const metrics: string[] = [];
  if (workout.strain != null) metrics.push(`${workout.strain.toFixed(1)} strain`);
  if (workout.avgHeartRate != null) metrics.push(`${workout.avgHeartRate} bpm avg`);
  if (workout.maxHeartRate != null) metrics.push(`${workout.maxHeartRate} bpm max`);
  if (workout.calories != null) metrics.push(`${workout.calories.toLocaleString("en-US")} kcal`);
  if (workout.distanceKm != null) metrics.push(`${workout.distanceKm.toFixed(1)} km`);

  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-3">
        <Activity className="size-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-text-2">{workout.sportName}</span>
          <Badge variant="neutral">WHOOP</Badge>
          {workout.scoreState === "PENDING_SCORE" && <Badge variant="info">PENDING</Badge>}
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-text-3">
          {workout.dateLabel} · {fmtDuration(workout.durationMin)}
          {metrics.length > 0 && ` · ${metrics.join(" · ")}`}
        </p>
      </div>
    </div>
  );
}
