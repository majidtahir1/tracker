import Link from "next/link";
import {
  Activity,
  BatteryLow,
  Bed,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Ruler,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, SectionCard } from "@/components/ui/Card";
import { Badge, DeloadBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import MonthGrid from "@/components/calendar/MonthGrid";
import { getCalendarData, parseMonthParam } from "@/lib/queries/calendar";
import { localToday, monthKey } from "@/lib/dates";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const ICON_BUTTON = `inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors border border-border bg-transparent text-text-2 hover:bg-surface-2 hover:text-text hover:border-border-strong size-9 p-0 ${RING}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.month);
  const selectedDay =
    params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const data = await getCalendarData(month, selectedDay);
  const today = localToday();

  const detail = data.selected;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendar"
        subtitle="Training days, rest days, deloads, and reminders."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${data.prevMonth}`}
              scroll={false}
              aria-label="Previous month"
              className={ICON_BUTTON}
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </Link>
            <span className="min-w-32 text-center font-display text-sm font-semibold text-text">
              {data.monthLabel}
            </span>
            <Link
              href={`/calendar?month=${data.nextMonth}`}
              scroll={false}
              aria-label="Next month"
              className={ICON_BUTTON}
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </Link>
            <Link
              href={`/calendar?month=${monthKey(today)}&day=${today}`}
              scroll={false}
              className={buttonClasses("ghost", "sm")}
            >
              Today
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="flex-1 p-5">
          <MonthGrid data={data} />
        </Card>

        {/* Selected-day panel */}
        <div className="lg:w-80 lg:shrink-0">
          {detail ? (
            <SectionCard
              title={detail.display}
              action={detail.isDeloadWeek ? <DeloadBadge /> : undefined}
            >
              <div className="space-y-4">
                {detail.workoutName ? (
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-3">
                      {detail.isDeloadWeek ? (
                        <BatteryLow className="size-4" strokeWidth={2} />
                      ) : (
                        <Dumbbell className="size-4" strokeWidth={2} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{detail.workoutName}</p>
                      <p className="mt-0.5 text-xs text-text-3">
                        {detail.state === "completed" && "Completed"}
                        {detail.state === "in-progress" && "In progress"}
                        {detail.state === "missed" && "Missed"}
                        {detail.state === "future" &&
                          (detail.date === data.today ? "Scheduled today" : "Scheduled")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-3">
                      <Bed className="size-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text">Rest day</p>
                      <p className="mt-0.5 text-xs text-text-3">
                        No session scheduled. Recovery is where growth happens.
                      </p>
                    </div>
                  </div>
                )}

                {detail.session && (
                  <div className="rounded-sm border border-border-faint bg-bg-subtle p-3">
                    <div
                      className={`grid gap-2 text-center ${detail.session.whoopStrain != null ? "grid-cols-4" : "grid-cols-3"}`}
                    >
                      <div>
                        <p className="font-display text-lg font-semibold tabular-nums text-text">
                          {detail.session.setsLogged}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-text-3">Sets</p>
                      </div>
                      <div>
                        <p className="font-display text-lg font-semibold tabular-nums text-text">
                          {Math.round(detail.session.totalVolume).toLocaleString("en-US")}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-text-3">Volume lb</p>
                      </div>
                      <div>
                        <p
                          className={`font-display text-lg font-semibold tabular-nums ${detail.session.prCount > 0 ? "text-accent" : "text-text"}`}
                        >
                          {detail.session.prCount}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-text-3">PRs</p>
                      </div>
                      {detail.session.whoopStrain != null && (
                        <div>
                          <p className="font-display text-lg font-semibold tabular-nums text-text">
                            {detail.session.whoopStrain.toFixed(1)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-text-3">Strain</p>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/workout/${detail.session.id}`}
                      className="mt-3 block text-center text-xs font-medium text-text-3 hover:text-accent transition-colors"
                    >
                      View session log →
                    </Link>
                  </div>
                )}

                {detail.whoopWorkouts.length > 0 && (
                  <ul className="space-y-2">
                    {detail.whoopWorkouts.map((w, i) => (
                      <li
                        key={`${w.sportName}-${i}`}
                        className="flex items-center gap-3 rounded-sm border border-border-faint bg-bg-subtle px-3 py-2"
                      >
                        <Activity className="size-3.5 shrink-0 text-text-3" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-text-2">{w.sportName}</p>
                          <p className="text-[11px] tabular-nums text-text-3">
                            {w.durationMin} min
                            {w.strain != null && ` · ${w.strain.toFixed(1)} strain`}
                            {w.calories != null && ` · ${w.calories.toLocaleString("en-US")} kcal`}
                          </p>
                        </div>
                        <Badge variant="neutral">WHOOP</Badge>
                      </li>
                    ))}
                  </ul>
                )}

                {detail.reminders.length > 0 && (
                  <ul className="space-y-2">
                    {detail.reminders.map((reminder) => (
                      <li key={reminder} className="flex items-center gap-2 text-xs text-warning">
                        {reminder.includes("photo") || reminder.includes("Photo") ? (
                          <Camera className="size-3.5" strokeWidth={2} />
                        ) : (
                          <Ruler className="size-3.5" strokeWidth={2} />
                        )}
                        {reminder}
                      </li>
                    ))}
                  </ul>
                )}

                {detail.state === "future" && detail.date === data.today && detail.workoutName && (
                  <Link href="/workout" className={`${buttonClasses("primary", "sm")} w-full`}>
                    Start today&apos;s workout
                  </Link>
                )}
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Day detail">
              <div className="flex flex-col items-center py-6 text-center">
                <CalendarDays className="size-8 text-text-faint" strokeWidth={1.75} />
                <p className="mt-3 text-sm font-semibold text-text">Pick a day.</p>
                <p className="mt-1 max-w-52 text-xs text-text-3">
                  Tap any date for the session summary, reminders, and a link to the full log.
                </p>
              </div>
            </SectionCard>
          )}

          {!data.hasAnyCompleted && (
            <p className="mt-4 px-1 text-xs text-text-3">
              Nothing logged yet — completed sessions turn their day green. Block 1 started{" "}
              <span className="tabular-nums">Jun 29</span>; deload lands on week 13.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
