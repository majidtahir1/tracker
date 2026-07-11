/**
 * Next Workout hero card (DESIGN.md §4.1 item 3) — the visual anchor of the
 * dashboard. Server component; links to /workout/today (workout team's route).
 */
import Link from "next/link";
import { Dumbbell, Play } from "lucide-react";
import { Badge, DeloadBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import type { NextWorkoutInfo } from "@/lib/queries/dashboard";

export default function NextWorkoutCard({
  next,
  isNewUser = false,
}: {
  next: NextWorkoutInfo | null;
  isNewUser?: boolean;
}) {
  if (!next) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-medium uppercase tracking-wider text-text-3">Next workout</p>
        <div className="mt-3 flex items-center gap-3">
          <Dumbbell className="size-5 text-text-faint" strokeWidth={2} />
          <p className="text-sm text-text-3">
            No active program schedule found. Seed the program to get Monday&rsquo;s Push session
            on the board.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] lg:flex lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-text-3">Next workout</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-text">
            {next.templateName}
          </h2>
          {next.isDeload && <DeloadBadge />}
        </div>
        <p className="mt-1 text-sm text-text-3 tabular-nums">
          {next.exerciseCount} exercises · ~{next.estMinutes} min · {next.dateLabel}
        </p>
        {isNewUser && (
          <p className="mt-2 text-xs text-text-3">
            We&rsquo;ve set you up on the built-in starter program —{" "}
            <Link href="/programs" className="font-medium text-accent hover:underline">
              browse or change it under Programs
            </Link>
            .
          </p>
        )}
        {next.progressionBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {next.progressionBadges.map((b) => (
              <Badge key={b.exerciseName} variant="accent">
                {b.exerciseName} +{b.deltaLb} lb ready
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 shrink-0 lg:mt-0">
        <ButtonLink href="/workout/today" size="lg" className="w-full sm:w-auto">
          <Play className="size-4" strokeWidth={2} />
          Start Workout
        </ButtonLink>
      </div>
    </div>
  );
}
