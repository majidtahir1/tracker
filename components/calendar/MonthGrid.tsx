/**
 * Month grid (server component) — day-cell states per DESIGN.md §3.11.
 * Each cell is a <Link> that selects the day via ?day= searchParam.
 */
import Link from "next/link";
import { Camera, Ruler } from "lucide-react";
import type { CalendarData, CalendarDay } from "@/lib/queries/calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function cellClasses(day: CalendarDay, isSelected: boolean): string {
  const base = `relative aspect-square rounded-sm border p-1.5 text-left transition-colors ${RING}`;
  const deload = day.isDeloadWeek ? " bg-info-muted/50" : "";
  let tone: string;
  if (day.state === "completed" || day.state === "in-progress") {
    tone = "border-border bg-surface hover:border-border-strong";
  } else {
    tone = "border-transparent bg-transparent hover:bg-surface";
  }
  const today = day.isToday ? " ring-1 ring-accent border-accent/40" : "";
  const selected = isSelected && !day.isToday ? " border-border-strong bg-surface-2" : "";
  const faded = day.inMonth ? "" : " opacity-40";
  return `${base} ${tone}${day.state === "completed" || day.state === "in-progress" ? "" : deload}${today}${selected}${faded}`;
}

function dayNumClasses(day: CalendarDay): string {
  if (day.isToday) return "text-xs font-semibold tabular-nums text-accent";
  if (day.isDeloadWeek) return "text-xs tabular-nums text-info";
  switch (day.state) {
    case "completed":
    case "in-progress":
      return "text-xs tabular-nums text-text-2";
    case "rest":
      return "text-xs tabular-nums text-text-faint";
    default:
      return "text-xs tabular-nums text-text-3";
  }
}

function DayDots({ day }: { day: CalendarDay }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 flex gap-1">
      {day.state === "completed" && <span className="size-1.5 rounded-full bg-success" />}
      {day.state === "in-progress" && <span className="size-1.5 rounded-full bg-warning" />}
      {day.state === "missed" && <span className="size-1.5 rounded-full bg-danger" />}
      {day.state === "future" && day.workoutName && (
        <span className="size-1.5 rounded-full border border-text-faint" />
      )}
      {day.whoopWorkoutCount > 0 && (
        <span className="size-1.5 rounded-full bg-[var(--color-chart-6)]/70" />
      )}
    </span>
  );
}

export default function MonthGrid({ data }: { data: CalendarData }) {
  const selectedDate = data.selected?.date ?? null;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 pb-2">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-xs uppercase tracking-wider text-text-3">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {data.weeks.flat().map((day) => (
          <Link
            key={day.date}
            href={`/calendar?month=${data.month}&day=${day.date}`}
            scroll={false}
            title={day.workoutName ?? "Rest day"}
            className={cellClasses(day, day.date === selectedDate)}
          >
            <span className={dayNumClasses(day)}>{day.dayOfMonth}</span>
            <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
              {day.isDeloadWeek && <span className="text-[9px] font-semibold text-info">D</span>}
              {day.photoReminder && <Camera className="size-3 text-warning" strokeWidth={2} />}
              {day.measurementReminder && <Ruler className="size-3 text-warning" strokeWidth={2} />}
            </span>
            <DayDots day={day} />
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-danger" /> Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-text-faint" /> Scheduled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-info-muted" /> Deload week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--color-chart-6)]/70" /> WHOOP activity
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Camera className="size-3 text-warning" strokeWidth={2} /> Photos due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Ruler className="size-3 text-warning" strokeWidth={2} /> Measurements due
        </span>
      </div>
    </div>
  );
}
