/**
 * Training-frequency heat strip (server component): weeks × days mini grid.
 * done = success dot cell, missed = danger, rest = transparent, future = hollow.
 */
import type { FrequencyWeek } from "@/lib/queries/analytics";

const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const CELL_CLASSES: Record<string, string> = {
  done: "bg-success/70",
  missed: "bg-danger/50",
  rest: "bg-surface-2",
  future: "border border-border bg-transparent",
};

export default function FrequencyStrip({ weeks }: { weeks: FrequencyWeek[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] gap-1.5">
        <span />
        {DOW_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[10px] uppercase tracking-wider text-text-3">
            {d}
          </span>
        ))}
        {weeks.map((week) => (
          <WeekRow key={week.weekStart} week={week} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-text-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success/70" /> Trained
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger/50" /> Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-surface-2" /> Rest
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-border" /> Upcoming
        </span>
      </div>
    </div>
  );
}

function WeekRow({ week }: { week: FrequencyWeek }) {
  return (
    <>
      <span className="self-center text-[10px] tabular-nums text-text-3">{week.label}</span>
      {week.days.map((day) => (
        <span
          key={day.date}
          title={day.date}
          className={`h-5 rounded-xs ${CELL_CLASSES[day.state]}`}
        />
      ))}
    </>
  );
}
