import { CalendarDays, Clock, Dumbbell, Play } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge, DeloadBadge } from "@/components/ui/Badge";
import Button, { ButtonLink } from "@/components/ui/Button";
import FullProgram from "@/components/workout/FullProgram";
import {
  getProgramOverview,
  getWorkoutOverview,
  type OverviewExercise,
} from "@/lib/queries/workout";
import { startWorkout } from "@/lib/actions/workout";
import { localToday } from "@/lib/dates";

export const metadata = { title: "Next Workout" };
export const dynamic = "force-dynamic";

function fmtWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10);
}

function fmtRest(seconds: number): string {
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m}m` : `${(seconds / 60).toFixed(1)}m`;
}

function recChip(ex: OverviewExercise) {
  if (ex.recommendation === "INCREASE" && ex.weight != null) {
    return <Badge variant="success">Increase weight → {fmtWeight(ex.weight)} lb</Badge>;
  }
  if (ex.recommendation === "DELOAD" && ex.weight != null) {
    return <Badge variant="info">Deload weight → {fmtWeight(ex.weight)} lb</Badge>;
  }
  if (ex.recommendation === "REDUCE" && ex.weight != null) {
    return <Badge variant="warning">Reduce weight → {fmtWeight(ex.weight)} lb</Badge>;
  }
  if (ex.recommendation === "REPEAT" && ex.weight != null) {
    return <Badge variant="neutral">Use {fmtWeight(ex.weight)} lb again</Badge>;
  }
  return <Badge variant="neutral">First session — choose a starting weight</Badge>;
}

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: overrideTemplateId } = await searchParams;
  const [{ position, inProgress, next }, { programs, activeProgramId }] = await Promise.all([
    getWorkoutOverview(overrideTemplateId),
    getProgramOverview(),
  ]);

  // Default to the program that owns today's suggested workout, else the
  // user's active program, else the first program with active days.
  const initialProgramId =
    (next?.isToday && programs.find((p) => p.workouts.some((w) => w.id === next.templateId))?.id) ||
    (activeProgramId && programs.some((p) => p.id === activeProgramId) ? activeProgramId : null) ||
    programs[0]?.id;

  const subtitle = position
    ? position.cycleComplete
      ? "Cycle complete — the next block starts with your next workout."
      : `Block cycle · Week ${position.week}${position.isDeload ? " · Deload" : ` · Phase ${position.phase}`}`
    : "No training block found.";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Next Workout"
        subtitle={subtitle}
        actions={position?.isDeload ? <DeloadBadge /> : undefined}
      />

      {inProgress && (
        <Card className="rounded-lg p-6 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-3">In progress</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-text">
              {inProgress.name}
            </h2>
            <p className="mt-1 text-sm tabular-nums text-text-3">
              {inProgress.dateLabel} · {inProgress.completedSets}/{inProgress.totalTargetSets} sets
              logged
            </p>
          </div>
          <div className="mt-5 lg:mt-0">
            <ButtonLink
              href={`/workout/${inProgress.id}`}
              size="lg"
              className="w-full active:scale-[0.98] sm:w-auto"
            >
              <Play className="size-5" strokeWidth={2} />
              Resume Workout
            </ButtonLink>
          </div>
        </Card>
      )}

      {next ? (
        <>
          <Card className="rounded-lg p-6 lg:flex lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-3">
                {next.isOverride ? "Selected workout" : "Next workout"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-text">
                  {next.templateName}
                </h2>
                {next.isDeload && <DeloadBadge />}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-3">
                <span>{next.exercises.length} exercises</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3.5" strokeWidth={2} />~{next.estMinutes} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" strokeWidth={2} />
                  {next.dateLabel}
                </span>
                <span className="tabular-nums">{next.totalSets} working sets</span>
              </p>
              {next.lowRecovery && !next.isDeload && (
                <p className="mt-3 max-w-xl rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-text-2">
                  Recovery is low today. Weight targets below are based purely on your last
                  performance — if you feel tired or low on energy, it&apos;s smart to drop a set
                  or take ~10% off, but that call is yours.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {next.exercises
                  .filter((e) => e.recommendation === "INCREASE" && e.weight != null)
                  .slice(0, 3)
                  .map((e) => (
                    <Badge key={e.templateExerciseId} variant="accent">
                      {e.name} {fmtWeight(e.weight as number)} lb ready
                    </Badge>
                  ))}
              </div>
            </div>
            {!inProgress && (
              <form action={startWorkout} className="mt-5 lg:mt-0 lg:shrink-0 lg:pl-6">
                <input type="hidden" name="templateId" value={next.templateId} />
                <input type="hidden" name="date" value={next.date} />
                <Button size="lg" className="w-full active:scale-[0.98] sm:w-auto">
                  <Play className="size-5" strokeWidth={2} />
                  Start Workout
                </Button>
              </form>
            )}
          </Card>

          <Card>
            <div className="border-b border-border-faint px-5 py-4">
              <h2 className="text-sm font-semibold text-text">The plan</h2>
            </div>
            <ul className="divide-y divide-border-faint">
              {next.exercises.map((ex) => (
                <li key={ex.templateExerciseId} className="px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-text">{ex.name}</span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-text-3">
                    {ex.sets} ×{" "}
                    {ex.repMin === ex.repMax
                      ? `${ex.repMax}${ex.isPerSide ? " each" : ""}`
                      : `${ex.repMin}–${ex.repMax}`}{" "}
                    · RIR {ex.rirMin}–{ex.rirMax} · rest {fmtRest(ex.restSeconds)}
                  </p>
                  <div className="mt-2">{recChip(ex)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        !inProgress && (
          <EmptyState
            icon={Dumbbell}
            title="Nothing on the schedule."
            body="No active workout templates found for the coming week. Program v1.0 trains Mon, Tue, Thu, and Fri."
          />
        )
      )}

      {programs.length > 0 && initialProgramId && (
        <FullProgram
          programs={programs}
          initialProgramId={initialProgramId}
          initialTemplateId={next?.isToday ? next.templateId : null}
          canStart={!inProgress}
          today={localToday()}
        />
      )}
    </div>
  );
}
