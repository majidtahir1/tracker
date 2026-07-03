"use client";

/**
 * components/workout/SetRow.tsx — one set-logging row (DESIGN.md §3.10).
 * Big thumb-friendly steppers (tap-to-type), RIR segmented control, done check,
 * previous-session ghost line.
 */
import { useEffect, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { PrevSet, SetData } from "./types";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function fmtWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10);
}

function Stepper({
  label,
  value,
  step,
  min = 0,
  integer = false,
  dim,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  integer?: boolean;
  dim: boolean;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(fmtWeight(value));
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setText(fmtWeight(value));
  }, [value]);

  const commit = (v: number) => {
    const next = Math.max(min, integer ? Math.round(v) : Math.round(v * 10) / 10);
    onCommit(next);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 130);
  };

  return (
    <div className={dim ? "opacity-70" : ""}>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-3">{label}</div>
      <div className="flex h-14 items-stretch overflow-hidden rounded-sm border border-border bg-surface-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className={`grid w-11 shrink-0 place-items-center text-text-3 transition-colors active:bg-surface-3 ${RING}`}
          onClick={() => commit(value - step)}
        >
          <Minus className="size-5" strokeWidth={2} />
        </button>
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = Number(text);
            if (Number.isFinite(parsed)) commit(parsed);
            else setText(fmtWeight(value));
          }}
          onFocus={(e) => e.target.select()}
          className={`min-w-14 flex-1 border-0 bg-transparent text-center font-display text-xl font-semibold tabular-nums text-text transition-transform duration-150 focus:outline-none focus:ring-0 ${
            pulse ? "scale-[1.06]" : "scale-100"
          }`}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className={`grid w-11 shrink-0 place-items-center text-text-3 transition-colors active:bg-surface-3 ${RING}`}
          onClick={() => commit(value + step)}
        >
          <Plus className="size-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function RirControl({
  value,
  dim,
  onChange,
}: {
  value: number | null;
  dim: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={dim ? "opacity-70" : ""}>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-3">RIR</div>
      <div className="inline-flex h-14 gap-1 rounded-sm border border-border bg-surface-2 p-1">
        {[0, 1, 2, 3].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`grid w-9 place-items-center rounded-xs text-sm tabular-nums transition-colors sm:w-10 ${RING} ${
              value === v || (v === 3 && value != null && value > 3)
                ? "bg-surface-3 font-semibold text-text"
                : "text-text-3"
            }`}
          >
            {v === 3 ? "3+" : v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SetRow({
  row,
  prev,
  weightStep,
  isBodyweight,
  onChange,
  onToggle,
}: {
  row: SetData;
  prev: PrevSet | undefined;
  weightStep: number;
  isBodyweight: boolean;
  onChange: (patch: Partial<SetData>) => void;
  onToggle: () => void;
}) {
  const beatWeight = row.completed && prev != null && row.weight > prev.weight;
  const beatReps =
    row.completed && prev != null && row.weight >= prev.weight && row.reps > prev.reps;

  return (
    <div>
      <div
        className={`grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2 py-2 sm:grid-cols-[auto_1fr_1fr_auto_auto] ${
          row.completed ? "rounded-sm bg-accent-muted/50" : ""
        }`}
      >
        <div
          className={`mb-2.5 grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${
            row.completed ? "bg-accent text-accent-text" : "bg-surface-2 text-text-3"
          }`}
        >
          {row.setNumber}
        </div>
        <Stepper
          label={isBodyweight ? "+LB" : "LB"}
          value={row.weight}
          step={weightStep}
          dim={row.completed}
          onCommit={(weight) => onChange({ weight })}
        />
        <Stepper
          label="REPS"
          value={row.reps}
          step={1}
          integer
          dim={row.completed}
          onCommit={(reps) => onChange({ reps })}
        />
        <div className="col-span-full flex items-end justify-between gap-2 sm:col-auto sm:col-span-1 sm:justify-start">
          <RirControl value={row.rir} dim={row.completed} onChange={(rir) => onChange({ rir })} />
          <button
            type="button"
            aria-label={row.completed ? "Mark set incomplete" : "Mark set complete"}
            onClick={onToggle}
            className={`mb-0 grid size-11 shrink-0 place-items-center rounded-sm border transition-colors sm:hidden ${RING} ${
              row.completed
                ? "border-accent bg-accent text-accent-text"
                : "border-border text-text-faint hover:border-border-strong"
            }`}
          >
            <Check className="size-5" strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          aria-label={row.completed ? "Mark set incomplete" : "Mark set complete"}
          onClick={onToggle}
          className={`mb-1.5 hidden size-11 shrink-0 place-items-center rounded-sm border transition-colors sm:grid ${RING} ${
            row.completed
              ? "border-accent bg-accent text-accent-text"
              : "border-border text-text-faint hover:border-border-strong"
          }`}
        >
          <Check className="size-5" strokeWidth={2} />
        </button>
      </div>
      <div className="pl-11 font-mono text-xs text-text-faint">
        {prev ? (
          <>
            prev{"  "}
            <span className={beatWeight ? "text-success" : undefined}>{fmtWeight(prev.weight)}</span>
            {" × "}
            <span className={beatReps ? "text-success" : undefined}>{prev.reps}</span>
            {prev.rir != null ? ` · RIR ${prev.rir}` : ""}
          </>
        ) : (
          "prev  —"
        )}
      </div>
    </div>
  );
}
