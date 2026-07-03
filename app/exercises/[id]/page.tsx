import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChartLine,
  ShieldCheck,
  SquarePlay,
  Trophy,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, SectionCard } from "@/components/ui/Card";
import ChartCard from "@/components/ui/ChartCard";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, DeloadBadge, type BadgeVariant } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import ExerciseProgressChart from "@/components/exercises/ExerciseProgressChart";
import ExerciseEditForm from "@/components/exercises/ExerciseEditForm";
import FavoriteToggle from "@/components/exercises/FavoriteToggle";
import BenchPressTechnique from "@/components/exercises/BenchPressTechnique";
import {
  DIFFICULTY_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  TYPE_LABELS,
} from "@/components/exercises/labels";
import { getExerciseDetail, type SlotRecommendation } from "@/lib/queries/exercises";
import { fmtDisplay } from "@/lib/dates";
import { PR_TYPE_LABELS } from "@/lib/pr";
import type { Recommendation } from "@/lib/progression";

export const metadata = { title: "Exercise" };
export const dynamic = "force-dynamic";

const REC_BADGE: Record<Recommendation, { variant: BadgeVariant; label: string }> = {
  FIRST_TIME: { variant: "neutral", label: "FIRST TIME" },
  INCREASE: { variant: "success", label: "INCREASE" },
  REPEAT: { variant: "neutral", label: "REPEAT" },
  REDUCE: { variant: "danger", label: "REDUCE" },
  DELOAD: { variant: "info", label: "DELOAD" },
};

function fmtLb(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1).replace(/\.0$/, "");
}

function recDescription(r: SlotRecommendation, isBodyweight: boolean): string {
  const unit = isBodyweight ? "lb added" : "lb";
  switch (r.result.rec) {
    case "FIRST_TIME":
      return "No history yet — the first session sets the baseline.";
    case "INCREASE":
      return `All sets hit ${r.repRangeMax} last time. Load ${fmtLb(r.result.weight ?? 0)} ${unit}, build back from ${r.result.targetReps ?? r.repRangeMin} reps.`;
    case "REPEAT":
      return `Stay at ${fmtLb(r.result.weight ?? 0)} ${unit} and add reps toward ${r.repRangeMax}.`;
    case "REDUCE":
      return `Back off to ${fmtLb(r.result.weight ?? 0)} ${unit} — recovery is low or the weight has stalled.`;
    case "DELOAD":
      return `Deload week: ${fmtLb(r.result.weight ?? 0)} ${unit}, half the sets, nothing near failure.`;
  }
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await getExerciseDetail(id);
  if (!exercise) notFound();

  const chartTitle = exercise.isBodyweight
    ? "Added weight over time"
    : "Working weight over time";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/exercises"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-3 transition-colors hover:text-text-2"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Exercise library
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
                {exercise.name}
              </h1>
              <FavoriteToggle exerciseId={exercise.id} isFavorite={exercise.isFavorite} />
            </div>
            <p className="mt-1 text-sm text-text-3">
              {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]} ·{" "}
              {TYPE_LABELS[exercise.type]} · {DIFFICULTY_LABELS[exercise.difficulty]}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {exercise.injuryFriendly && (
                <Badge variant="info">
                  <ShieldCheck className="size-3" strokeWidth={2} />
                  JOINT-FRIENDLY
                </Badge>
              )}
              {exercise.isBodyweight && <Badge variant="neutral">BODYWEIGHT</Badge>}
            </div>
          </div>
          {exercise.videoUrl && (
            <ButtonLink href={exercise.videoUrl} variant="ghost" size="sm">
              <SquarePlay className="size-4" strokeWidth={2} />
              Watch form video
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---- Left: progression history ---- */}
        <div className="space-y-5 lg:col-span-2">
          <ChartCard
            title={chartTitle}
            height="h-64"
            legend={
              exercise.history.some((h) => h.e1rm != null)
                ? [
                    { label: exercise.isBodyweight ? "Added weight" : "Top set (lb)", colorVar: "--color-chart-1" },
                    { label: "e1RM (lb)", colorVar: "--color-chart-6" },
                  ]
                : undefined
            }
          >
            {exercise.history.length === 0 ? (
              <EmptyState
                chart
                icon={ChartLine}
                title="No sessions logged yet."
                body="First session's the baseline. Log it and the trend line starts here."
              />
            ) : (
              <ExerciseProgressChart
                history={exercise.history}
                isBodyweight={exercise.isBodyweight}
              />
            )}
          </ChartCard>

          <SectionCard title="Session log" flush>
            {exercise.sessionLog.length === 0 ? (
              <EmptyState
                chart
                icon={ChartLine}
                title="No sets logged yet."
                body="Every completed session with this movement lands here — sets, volume, e1RM."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                        Date
                      </th>
                      <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                        Workout
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
                    {exercise.sessionLog.map((row) => (
                      <tr
                        key={`${row.sessionId}-${row.date}`}
                        className="border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-5 py-3.5 text-text-2">
                          <span className="inline-flex items-center gap-2">
                            {fmtDisplay(row.date)}
                            {row.isDeload && <DeloadBadge />}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-text-2">{row.workoutName}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-text-2">
                          {row.setsSummary}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-text">
                          {row.volume.toLocaleString("en-US")} lb
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-text">
                          {row.bestE1rm != null ? (
                            row.bestE1rm
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {exercise.personalRecords.length > 0 && (
            <SectionCard title="Personal records" flush>
              <ul className="divide-y divide-border-faint">
                {exercise.personalRecords.map((pr) => (
                  <li
                    key={`${pr.type}-${pr.date}-${pr.value}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-text-2">
                      <Trophy className="size-4 text-text-3" strokeWidth={2} />
                      {PR_TYPE_LABELS[pr.type]}
                    </span>
                    <span className="text-right text-sm tabular-nums text-text">
                      {pr.type === "MOST_REPS"
                        ? `${pr.reps} reps @ ${fmtLb(pr.weight ?? 0)} lb`
                        : `${fmtLb(pr.value)} lb`}
                      <span className="ml-2 text-xs text-text-faint">{fmtDisplay(pr.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        {/* ---- Right rail ---- */}
        <div className="space-y-5">
          <SectionCard title="Details">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Primary muscle</dt>
                <dd className="text-right text-text-2">{MUSCLE_LABELS[exercise.primaryMuscle]}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Secondary</dt>
                <dd className="text-right text-text-2">
                  {exercise.secondaryMuscles.length > 0
                    ? exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")
                    : "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Equipment</dt>
                <dd className="text-right text-text-2">{EQUIPMENT_LABELS[exercise.equipment]}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Type</dt>
                <dd className="text-right text-text-2">{TYPE_LABELS[exercise.type]}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Difficulty</dt>
                <dd className="text-right text-text-2">{DIFFICULTY_LABELS[exercise.difficulty]}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-3">Weight increment</dt>
                <dd className="text-right tabular-nums text-text-2">
                  {fmtLb(exercise.weightIncrement)} lb
                </dd>
              </div>
            </dl>
            {exercise.notes && (
              <p className="mt-4 border-t border-border-faint pt-4 text-xs text-text-3">
                {exercise.notes}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Next session">
            {exercise.recommendations.length === 0 ? (
              <p className="text-xs text-text-3">
                Not in the current program. Add it to a workout to start tracking progression.
              </p>
            ) : (
              <ul className="space-y-4">
                {exercise.recommendations.map((r) => (
                  <li key={r.slotId}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-2">{r.slotLabel}</span>
                      <Badge variant={REC_BADGE[r.result.rec].variant}>
                        {REC_BADGE[r.result.rec].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-text-3">
                      {recDescription(r, exercise.isBodyweight)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Alternatives">
            {exercise.alternatives.length === 0 ? (
              <p className="text-xs text-text-3">
                No curated alternatives yet for this movement.
              </p>
            ) : (
              <ul className="space-y-2">
                {exercise.alternatives.map((alt) => (
                  <li key={alt.id}>
                    <Link
                      href={`/exercises/${alt.id}`}
                      className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface-2 px-3.5 py-2.5 transition-colors hover:border-border-strong"
                    >
                      <span className="text-sm font-medium text-text-2">{alt.name}</span>
                      <span className="text-xs text-text-3">
                        {EQUIPMENT_LABELS[alt.equipment]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex gap-2 border-t border-border-faint pt-4 text-xs text-text-3">
              <ArrowLeftRight className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              <span>
                Substitutions preserve history: progression, charts and recommendations follow
                the program slot, not the exercise — swap during a workout and nothing resets.
              </span>
            </p>
          </SectionCard>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text">Edit exercise</h2>
            <div className="mt-4">
              <ExerciseEditForm
                exercise={{
                  id: exercise.id,
                  notes: exercise.notes,
                  videoUrl: exercise.videoUrl,
                  isFavorite: exercise.isFavorite,
                  injuryFriendly: exercise.injuryFriendly,
                }}
              />
            </div>
          </Card>
        </div>
      </div>

      {exercise.name === "Bench Press" && <BenchPressTechnique />}
    </div>
  );
}
