"use client";

/**
 * "Full program" section: program dropdown → workout dropdown → Start today.
 * Selecting a workout also updates ?template= so the page's preview (targets
 * and weight recommendations) re-renders for it before the user starts.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Play } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { startWorkout } from "@/lib/actions/workout";
import type { ProgramOverview } from "@/lib/queries/workout";

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-3"
        strokeWidth={2}
      />
    </div>
  );
}

const selectClass =
  "h-11 w-full appearance-none rounded-sm border border-border bg-surface-2 px-3.5 pr-10 text-sm text-text transition-colors hover:border-border-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:w-auto";

export default function FullProgram({
  programs,
  initialProgramId,
  initialTemplateId,
  canStart,
  today,
}: {
  programs: ProgramOverview[];
  initialProgramId: string;
  initialTemplateId: string | null;
  canStart: boolean;
  today: string;
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(initialProgramId);
  const program = programs.find((p) => p.id === programId) ?? programs[0];
  const [templateId, setTemplateId] = useState(
    initialTemplateId ?? program?.workouts[0]?.id ?? ""
  );

  if (!program) return null;

  function previewTemplate(id: string) {
    setTemplateId(id);
    // Re-render the page's preview card (targets + weight recommendations)
    // for this workout, and bring it into view.
    router.replace(id ? `/workout?template=${id}` : "/workout", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectProgram(id: string) {
    setProgramId(id);
    const nextProgram = programs.find((p) => p.id === id);
    previewTemplate(nextProgram?.workouts[0]?.id ?? "");
  }

  const programSelect = (
    <SelectShell>
      <select
        aria-label="Choose a program"
        value={program.id}
        onChange={(e) => selectProgram(e.target.value)}
        className={selectClass}
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </SelectShell>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text">
            Full program
          </h2>
          <p className="mt-1 text-sm text-text-3">
            Current block targets for every active training day.
          </p>
        </div>

        {canStart ? (
          <form action={startWorkout} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="date" value={today} />
            <input type="hidden" name="scheduleOverride" value="today" />
            {programSelect}
            <SelectShell>
              <select
                name="templateId"
                aria-label="Choose today's workout"
                value={templateId}
                onChange={(e) => previewTemplate(e.target.value)}
                className={`${selectClass} sm:min-w-64`}
              >
                {program.workouts.map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    Day {workout.dayNumber} — {workout.name}
                  </option>
                ))}
              </select>
            </SelectShell>
            <Button className="shrink-0">
              <Play className="size-4" strokeWidth={2} />
              Start today
            </Button>
          </form>
        ) : (
          programSelect
        )}
      </div>

      {!canStart && (
        <p className="text-sm text-text-3">
          Finish or cancel the workout in progress before choosing another program day.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {program.workouts.map((workout) => (
          <Card key={workout.id} className="overflow-hidden">
            <div className="border-b border-border-faint px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                Day {workout.dayNumber}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold text-text">{workout.name}</h3>
              <p className="mt-1 text-xs text-text-3">
                {workout.exercises.length} exercises ·{" "}
                {workout.exercises.reduce((sum, ex) => sum + ex.sets, 0)} sets
              </p>
            </div>
            <ul className="divide-y divide-border-faint">
              {workout.exercises.map((exercise) => (
                <li key={exercise.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="min-w-0 truncate text-sm font-medium text-text">
                    {exercise.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-3">
                    {exercise.sets} ×{" "}
                    {exercise.repMin === exercise.repMax
                      ? exercise.repMax
                      : `${exercise.repMin}–${exercise.repMax}`}
                    {exercise.isPerSide ? " each" : ""} · RIR {exercise.rirMin}–{exercise.rirMax}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
