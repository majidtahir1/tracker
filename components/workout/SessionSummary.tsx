/**
 * components/workout/SessionSummary.tsx — read-only summary for a completed
 * session (rendered by /workout/[sessionId] and reached from /history).
 * Server component: receives pre-computed props from lib/queries/workout.
 */
import { BarChart3, CheckCheck, Clock, HeartPulse, Repeat2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/Card";
import { Badge, DeloadBadge, PRBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { fmtDisplay } from "@/lib/dates";
import type { SessionSummaryData } from "@/lib/queries/workout";
import type { LoggerSession } from "./types";

function fmtVolume(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")}`;
}

export default function SessionSummary({
  session,
  summary,
}: {
  session: LoggerSession;
  summary: SessionSummaryData;
}) {
  const delta = summary.volumeDeltaPct;
  return (
    <div className="space-y-8">
      <PageHeader
        title={session.name}
        subtitle={`${fmtDisplay(session.date)} · Week ${session.weekInCycle}${
          session.isDeload ? "" : ` · Phase ${session.blockPhase}`
        }`}
        actions={
          <div className="flex items-center gap-2">
            {session.isDeload && <DeloadBadge />}
            <Badge variant="success">
              <CheckCheck className="size-3" strokeWidth={2} />
              COMPLETED
            </Badge>
          </div>
        }
      />

      {summary.prs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {summary.prs.map((pr) => (
            <span key={pr.id} className="inline-flex items-center gap-2">
              <PRBadge type={pr.label.replace(/^PR · /, "")} />
              <span className="text-xs text-text-3">{pr.exerciseName}</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Volume"
          value={fmtVolume(summary.totalVolume)}
          unit="lb"
          icon={BarChart3}
          trend={
            delta != null
              ? {
                  direction: delta >= 0 ? ("up" as const) : ("down" as const),
                  good: delta >= 0,
                  label: `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}% vs last time`,
                }
              : undefined
          }
        />
        <StatCard
          label="Sets"
          value={`${summary.completedSets}`}
          unit={`/ ${summary.targetSets}`}
          icon={CheckCheck}
        />
        <StatCard
          label="Avg Reps"
          value={summary.avgReps != null ? summary.avgReps.toFixed(1) : "—"}
          icon={Repeat2}
        />
        <StatCard
          label="Duration"
          value={summary.durationMinutes != null ? `${summary.durationMinutes}` : "—"}
          unit={summary.durationMinutes != null ? "min" : undefined}
          icon={Clock}
        />
      </div>

      {summary.whoop && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-border-faint bg-bg-subtle px-4 py-3">
          <span className="flex items-center gap-2">
            <HeartPulse className="size-4 text-text-3" strokeWidth={2} />
            <Badge variant="neutral">WHOOP</Badge>
            <span className="text-xs font-medium text-text-2">{summary.whoop.sportName}</span>
          </span>
          <span className="text-xs tabular-nums text-text-3">
            {summary.whoop.strain != null && `${summary.whoop.strain.toFixed(1)} strain`}
            {summary.whoop.avgHeartRate != null && ` · ${summary.whoop.avgHeartRate} bpm avg`}
            {summary.whoop.maxHeartRate != null && ` · ${summary.whoop.maxHeartRate} bpm max`}
            {summary.whoop.calories != null &&
              ` · ${summary.whoop.calories.toLocaleString("en-US")} kcal`}
            {` · ${summary.whoop.durationMin} min recorded`}
          </span>
        </div>
      )}

      <SectionCard title="Exercises" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                  Exercise
                </th>
                <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                  Sets
                </th>
                <th className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3">
                  Volume
                </th>
                <th className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3">
                  e1RM
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.exercises.map((ex) => (
                <tr
                  key={ex.sessionExerciseId}
                  className="border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2"
                >
                  <td className="px-5 py-3.5 text-text-2">
                    <span className="font-medium text-text">{ex.name}</span>
                    {ex.prLabels.length > 0 && (
                      <span className="ml-2 inline-flex gap-1">
                        {ex.prLabels.map((l) => (
                          <Badge key={l} variant="accent">
                            {l}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-text-2">
                    {ex.setSummary || <span className="text-text-faint">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-text">
                    {ex.volume > 0 ? fmtVolume(ex.volume) : <span className="text-text-faint">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-text">
                    {ex.bestE1rm ?? <span className="text-text-faint">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/history" variant="ghost">
          Back to history
        </ButtonLink>
        <ButtonLink href="/workout" variant="ghost">
          Next workout
        </ButtonLink>
        <ButtonLink href={`/workout/${session.id}?edit=1`} variant="subtle">
          Edit sets
        </ButtonLink>
      </div>
    </div>
  );
}
