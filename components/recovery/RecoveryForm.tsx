"use client";

/**
 * Daily recovery check-in (DESIGN.md §4.6): segmented 1–5 rows, sleep-hours
 * stepper (±0.5), live-computed 0–100 score in a colored ring.
 */
import { useActionState, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import { FieldError, Textarea, Label } from "@/components/ui/Input";
import { recoveryScore, recoveryBand } from "@/lib/recovery";
import { saveRecovery, type ActionState } from "@/lib/actions/tracking";
import type { RecoveryTodayValues } from "@/lib/queries/tracking";

const IDLE: ActionState = { ok: false };

type RatingKey =
  | "sleepQuality"
  | "stress"
  | "energy"
  | "motivation"
  | "workoutDifficulty"
  | "soreness";

const RATING_ROWS: Array<{ key: RatingKey; label: string; low: string; high: string }> = [
  { key: "sleepQuality", label: "Sleep quality", low: "rough", high: "great" },
  { key: "stress", label: "Stress", low: "calm", high: "fried" },
  { key: "energy", label: "Energy", low: "drained", high: "charged" },
  { key: "motivation", label: "Motivation", low: "meh", high: "fired up" },
  { key: "workoutDifficulty", label: "Yesterday's workout", low: "easy", high: "brutal" },
  { key: "soreness", label: "Soreness", low: "fresh", high: "wrecked" },
];

const BAND_STYLES = {
  recovered: { ring: "border-success", text: "text-success", label: "Recovered" },
  manage: { ring: "border-warning", text: "text-warning", label: "Manage load" },
  fatigued: { ring: "border-danger", text: "text-danger", label: "Fatigued" },
} as const;

function SegmentRow({
  row,
  value,
  onChange,
}: {
  row: (typeof RATING_ROWS)[number];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-text-3">{row.label}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-faint">
          1 {row.low} · 5 {row.high}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`h-11 flex-1 rounded-xs text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
              value === v
                ? "bg-accent font-semibold text-accent-text"
                : "bg-surface-2 text-text-3 hover:bg-surface-3 hover:text-text-2"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecoveryForm({
  date,
  initial,
}: {
  date: string;
  initial: RecoveryTodayValues | null;
}) {
  const [state, formAction, pending] = useActionState(saveRecovery, IDLE);
  const [sleepHours, setSleepHours] = useState<number | null>(initial?.sleepHours ?? null);
  const [ratings, setRatings] = useState<Record<RatingKey, number | null>>({
    sleepQuality: initial?.sleepQuality ?? null,
    stress: initial?.stress ?? null,
    energy: initial?.energy ?? null,
    motivation: initial?.motivation ?? null,
    workoutDifficulty: initial?.workoutDifficulty ?? null,
    soreness: initial?.soreness ?? null,
  });

  const score = recoveryScore({ sleepHours, ...ratings });
  const band = score != null ? BAND_STYLES[recoveryBand(score)] : null;

  const bumpSleep = (delta: number) => {
    setSleepHours((prev) => {
      const next = (prev ?? 7.5) + delta;
      return Math.min(Math.max(Math.round(next * 2) / 2, 0), 24);
    });
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="sleepHours" value={sleepHours ?? ""} />
      {RATING_ROWS.map((row) => (
        <input key={row.key} type="hidden" name={row.key} value={ratings[row.key] ?? ""} />
      ))}

      {/* Live score ring */}
      <div className="flex items-center gap-5">
        <div
          className={`grid size-24 shrink-0 place-items-center rounded-full border-4 ${
            band ? band.ring : "border-border"
          }`}
        >
          <span
            className={`font-display text-4xl font-semibold tabular-nums ${
              band ? band.text : "text-text-faint"
            }`}
          >
            {score ?? "—"}
          </span>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-text-3">
            Recovery score
          </div>
          <div className={`mt-1 text-sm font-semibold ${band ? band.text : "text-text-faint"}`}>
            {band ? band.label : "Answer below — the score updates live."}
          </div>
          <div className="mt-0.5 text-xs text-text-3">70+ recovered · 40–69 manage · &lt;40 back off</div>
        </div>
      </div>

      {/* Sleep hours stepper */}
      <div className="mt-6">
        <div className="mb-1.5 text-xs font-medium text-text-3">Sleep hours</div>
        <div className="flex h-14 max-w-56 items-stretch overflow-hidden rounded-sm border border-border bg-surface-2">
          <button
            type="button"
            aria-label="Less sleep"
            onClick={() => bumpSleep(-0.5)}
            className="grid w-11 place-items-center text-text-3 transition-colors active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Minus className="size-5" strokeWidth={2} />
          </button>
          <div className="grid min-w-14 flex-1 place-items-center font-display text-xl font-semibold tabular-nums text-text">
            {sleepHours != null ? sleepHours : "—"}
            <span className="sr-only">hours of sleep</span>
          </div>
          <button
            type="button"
            aria-label="More sleep"
            onClick={() => bumpSleep(0.5)}
            className="grid w-11 place-items-center text-text-3 transition-colors active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Plus className="size-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 1–5 segmented rows */}
      <div className="mt-6 space-y-5">
        {RATING_ROWS.map((row) => (
          <SegmentRow
            key={row.key}
            row={row}
            value={ratings[row.key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [row.key]: v }))}
          />
        ))}
      </div>

      <div className="mt-6">
        <Label htmlFor="r-notes">Notes</Label>
        <Textarea
          id="r-notes"
          name="notes"
          placeholder="Late night, long commute, extra caffeine…"
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      {state.error && <FieldError>{state.error}</FieldError>}

      <div className="mt-6">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : initial ? "Update check-in" : "Save check-in"}
        </Button>
        {state.ok && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" strokeWidth={2} /> Check-in saved.
          </p>
        )}
      </div>
    </form>
  );
}
