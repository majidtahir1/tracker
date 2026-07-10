"use client";

/**
 * components/workout/WorkoutLogger.tsx — the money screen (DESIGN.md §4.2).
 * Scrollable exercise cards (one expanded at a time), sticky session header,
 * optimistic set logging via server actions, PR pops, substitution sheet.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BatteryLow,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  EllipsisVertical,
  Flag,
  Plus,
  Repeat,
  Sparkles,
  StickyNote,
  TrendingUp,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, PRBadge, DeloadBadge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import {
  cancelWorkout,
  finishWorkout,
  logSet,
  substituteExercise,
  updateExerciseNotes,
} from "@/lib/actions/workout";
import type { FiredPr, LoggerExercise, LoggerSession, SetData } from "./types";
import { buildRows } from "./build-rows";
import SetRow from "./SetRow";
import { askSetCoach } from "@/lib/actions/set-coach";
import type { SetCoachResponse } from "@/lib/ai/set-coach-types";
import { getExerciseRecap } from "@/lib/actions/exercise-recap";
import type { ExerciseRecapResponse } from "@/lib/ai/exercise-recap-types";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function fmtWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10);
}

function fmtRest(seconds: number): string {
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m}m` : `${Math.floor(m)}:${String(seconds % 60).padStart(2, "0")}m`;
}

function epleyLocal(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function ElapsedClock({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const label =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Clock className="size-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------

export default function WorkoutLogger({ session, editMode = false }: { session: LoggerSession; editMode?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [rowsMap, setRowsMap] = useState<Record<string, SetData[]>>(() =>
    Object.fromEntries(session.exercises.map((ex) => [ex.sessionExerciseId, buildRows(ex)]))
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    const firstIncomplete = session.exercises.find((ex) => {
      const done = ex.sets.filter((s) => s.completed).length;
      return done < Math.max(ex.targetSets, ex.sets.length);
    });
    return (firstIncomplete ?? session.exercises[0])?.sessionExerciseId ?? null;
  });
  const [prFlash, setPrFlash] = useState<Record<string, FiredPr[]>>({});
  // Coach recap fired when an exercise's last set completes. forExerciseId is
  // the card it renders on (the next exercise), or null after the final one.
  const [recap, setRecap] = useState<{
    forExerciseId: string | null;
    data: ExerciseRecapResponse;
  } | null>(null);
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const totals = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of session.exercises) {
      const rows = rowsMap[ex.sessionExerciseId] ?? [];
      total += rows.length;
      done += rows.filter((r) => r.completed).length;
    }
    return { done, total };
  }, [rowsMap, session.exercises]);

  const save = (ex: LoggerExercise, row: SetData, afterSave?: () => Promise<void>) => {
    startTransition(async () => {
      const res = await logSet({
        sessionExerciseId: ex.sessionExerciseId,
        setNumber: row.setNumber,
        weight: row.weight,
        reps: row.reps,
        rir: row.rir,
        completed: row.completed,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the set.");
        return;
      }
      setError(null);
      if (res.setId) {
        setRowsMap((m) => ({
          ...m,
          [ex.sessionExerciseId]: (m[ex.sessionExerciseId] ?? []).map((r) =>
            r.setNumber === row.setNumber ? { ...r, id: res.setId ?? r.id } : r
          ),
        }));
      }
      if (res.prs.length > 0) {
        setPrFlash((p) => {
          const seen = new Set((p[ex.sessionExerciseId] ?? []).map((x) => x.type));
          const merged = [
            ...(p[ex.sessionExerciseId] ?? []),
            ...res.prs.filter((x) => !seen.has(x.type)),
          ];
          return { ...p, [ex.sessionExerciseId]: merged };
        });
      }
      await afterSave?.();
    });
  };

  const patchRow = (ex: LoggerExercise, setNumber: number, patch: Partial<SetData>) => {
    const rows = (rowsMap[ex.sessionExerciseId] ?? []).map((r) =>
      r.setNumber === setNumber ? { ...r, ...patch } : r
    );
    setRowsMap((m) => ({ ...m, [ex.sessionExerciseId]: rows }));
    const updated = rows.find((r) => r.setNumber === setNumber);
    // Completed rows re-save on edit so the log stays truthful.
    if (updated?.completed && !("completed" in patch)) save(ex, updated);
  };

  const toggleRow = (ex: LoggerExercise, setNumber: number) => {
    const rows = (rowsMap[ex.sessionExerciseId] ?? []).map((r) =>
      r.setNumber === setNumber ? { ...r, completed: !r.completed } : r
    );
    setRowsMap((m) => ({ ...m, [ex.sessionExerciseId]: rows }));
    const updated = rows.find((r) => r.setNumber === setNumber);
    const exerciseDone = updated?.completed === true && rows.every((r) => r.completed);
    const idx = session.exercises.findIndex((e) => e.sessionExerciseId === ex.sessionExerciseId);
    const nextEx = exerciseDone
      ? session.exercises
          .slice(idx + 1)
          .find((e) => (rowsMap[e.sessionExerciseId] ?? []).some((r) => !r.completed))
      : undefined;
    if (updated) {
      // The recap runs after logSet resolves so the server sees the final set.
      const fetchRecap =
        exerciseDone && !editMode
          ? async () => {
              const res = await getExerciseRecap(ex.sessionExerciseId);
              if (res.ok) {
                setRecap({ forExerciseId: nextEx?.sessionExerciseId ?? null, data: res.recap });
              }
            }
          : undefined;
      save(ex, updated, fetchRecap);
    }
    // Auto-advance: finishing the last set collapses into the next exercise.
    if (exerciseDone) {
      if (nextEx) {
        setActiveId(nextEx.sessionExerciseId);
        window.setTimeout(() => {
          cardRefs.current[nextEx.sessionExerciseId]?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 60);
      }
    }
  };

  const addSet = (ex: LoggerExercise) => {
    setRowsMap((m) => {
      const rows = m[ex.sessionExerciseId] ?? [];
      const last = rows[rows.length - 1];
      return {
        ...m,
        [ex.sessionExerciseId]: [
          ...rows,
          {
            id: null,
            setNumber: Math.max(0, ...rows.map((r) => r.setNumber)) + 1,
            weight: last?.weight ?? ex.targetWeight ?? 0,
            reps: last?.reps ?? ex.targetRepMin,
            rir: null,
            completed: false,
          },
        ],
      };
    });
  };

  const applyWeight = (ex: LoggerExercise, weight: number) => {
    setRowsMap((m) => ({
      ...m,
      [ex.sessionExerciseId]: (m[ex.sessionExerciseId] ?? []).map((r) =>
        r.completed ? r : { ...r, weight }
      ),
    }));
  };

  const handleFinish = () => {
    const remaining = totals.total - totals.done;
    if (
      remaining > 0 &&
      !window.confirm(`${remaining} set${remaining === 1 ? "" : "s"} not logged. Finish anyway?`)
    ) {
      return;
    }
    setFinishing(true);
    startTransition(async () => {
      const res = await finishWorkout(session.id);
      if (!res.ok) {
        setError(res.error ?? "Couldn't finish the workout.");
        setFinishing(false);
        return;
      }
      router.refresh();
    });
  };

  const handleCancel = () => {
    if (!window.confirm("Cancel this workout? Logged sets will be discarded.")) return;
    startTransition(async () => {
      await cancelWorkout(session.id);
    });
  };

  const swapExercise = session.exercises.find((e) => e.sessionExerciseId === swapForId) ?? null;

  return (
    <div className="space-y-4">
      {/* Sticky session header */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-text">
              {session.name}
            </h1>
            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-text-3">
              <span className="tabular-nums">
                {totals.done}/{totals.total} sets
              </span>
              <ElapsedClock startedAt={session.startedAt} />
              <span>
                Wk {session.weekInCycle}
                {session.isDeload ? "" : ` · Phase ${session.blockPhase}`}
              </span>
              {session.isDeload && <DeloadBadge />}
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            {editMode ? (
              <Button size="sm" onClick={() => router.push(`/workout/${session.id}`)}>
                <Check className="size-4" strokeWidth={2} />
                Done editing
              </Button>
            ) : <Button size="sm" onClick={handleFinish} disabled={finishing}>
              <CheckCheck className="size-4" strokeWidth={2} />
              {finishing ? "Finishing…" : "Finish"}
            </Button>}
            {!editMode && <button
              type="button"
              aria-label="Session menu"
              onClick={() => setMenuOpen((v) => !v)}
              className={`grid size-8 place-items-center rounded-sm border border-border text-text-3 transition-colors hover:bg-surface-2 hover:text-text ${RING}`}
            >
              <EllipsisVertical className="size-4" strokeWidth={2} />
            </button>}
            {!editMode && menuOpen && (
              <div className="absolute right-0 top-10 z-40 w-44 rounded-sm border border-border bg-surface-2 p-1 shadow-[var(--shadow-raise)]">
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`block w-full rounded-xs px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-muted ${RING}`}
                >
                  Cancel workout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-danger/25 bg-danger-muted px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Exercise cards */}
      <div className="space-y-3 pb-20 lg:pb-0">
        {session.exercises.map((ex) => {
          const rows = rowsMap[ex.sessionExerciseId] ?? [];
          const doneCount = rows.filter((r) => r.completed).length;
          const expanded = activeId === ex.sessionExerciseId;
          return (
            <div
              key={ex.sessionExerciseId}
              ref={(el) => {
                cardRefs.current[ex.sessionExerciseId] = el;
              }}
              className="scroll-mt-20"
            >
              {expanded && recap?.forExerciseId === ex.sessionExerciseId && (
                <RecapBanner recap={recap.data} onDismiss={() => setRecap(null)} />
              )}
              {expanded ? (
                <ExpandedCard
                  ex={ex}
                  rows={rows}
                  prs={prFlash[ex.sessionExerciseId] ?? []}
                  onPatch={(n, p) => patchRow(ex, n, p)}
                  onToggle={(n) => toggleRow(ex, n)}
                  onAddSet={() => addSet(ex)}
                  onKeepWeight={(w) => applyWeight(ex, w)}
                  onSwap={() => setSwapForId(ex.sessionExerciseId)}
                  editMode={editMode}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveId(ex.sessionExerciseId)}
                  className={`flex w-full items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-colors hover:border-border-strong ${RING}`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full ${
                      doneCount >= rows.length && rows.length > 0
                        ? "bg-accent text-accent-text"
                        : "border border-border text-text-faint"
                    }`}
                  >
                    <Check className="size-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                    {ex.name}
                  </span>
                  <span className="text-xs tabular-nums text-text-3">
                    {doneCount}/{rows.length} sets
                  </span>
                  <ChevronDown className="size-4 text-text-3 transition-transform duration-200" strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}
        {recap && recap.forExerciseId === null && (
          <RecapBanner recap={recap.data} onDismiss={() => setRecap(null)} />
        )}
      </div>

      {/* Bottom sticky bar (mobile) */}
      {!editMode && <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-bg-subtle/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm tabular-nums text-text-2">
            <span className="font-semibold text-text">{totals.done}</span>/{totals.total} sets
          </span>
          <Button size="sm" onClick={handleFinish} disabled={finishing}>
            <CheckCheck className="size-4" strokeWidth={2} />
            Finish
          </Button>
        </div>
      </div>}

      {/* Substitution sheet */}
      {swapExercise && (
        <SwapSheet
          ex={swapExercise}
          onClose={() => setSwapForId(null)}
          onSwapped={() => {
            setSwapForId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ExpandedCard({
  ex,
  rows,
  prs,
  onPatch,
  onToggle,
  onAddSet,
  onKeepWeight,
  onSwap,
  editMode,
}: {
  ex: LoggerExercise;
  rows: SetData[];
  prs: FiredPr[];
  onPatch: (setNumber: number, patch: Partial<SetData>) => void;
  onToggle: (setNumber: number) => void;
  onAddSet: () => void;
  onKeepWeight: (weight: number) => void;
  onSwap: () => void;
  editMode: boolean;
}) {
  const [, startTransition] = useTransition();
  const [coachPending, startCoachTransition] = useTransition();
  const [notesOpen, setNotesOpen] = useState(Boolean(ex.notes));
  const [notes, setNotes] = useState(ex.notes ?? "");
  const [coachAdvice, setCoachAdvice] = useState<SetCoachResponse | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

  const done = rows.filter((r) => r.completed);
  const liveVolume = done.reduce((n, r) => n + r.weight * r.reps, 0);
  const liveE1rm = done.reduce((n, r) => Math.max(n, epleyLocal(r.weight, r.reps)), 0);

  const repRange =
    ex.targetRepMin === ex.targetRepMax
      ? `${ex.targetRepMax}${ex.isPerSide ? " each" : ""}`
      : `${ex.targetRepMin}–${ex.targetRepMax}`;
  const targetChip = `${ex.targetSets} × ${repRange} · RIR ${ex.targetRirMin}–${ex.targetRirMax} · rest ${fmtRest(ex.restSeconds)}`;

  return (
    <Card className={prs.length > 0 ? "border-accent-border transition-colors duration-700" : ""}>
      <div className="flex items-start justify-between gap-3 border-b border-border-faint px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-text">{ex.name}</h2>
          </div>
          <p className="mt-1 text-xs text-text-3">{targetChip}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="Exercise notes"
            onClick={() => setNotesOpen((v) => !v)}
            className={`grid size-8 place-items-center rounded-sm border border-border text-text-3 transition-colors hover:bg-surface-2 hover:text-text ${RING}`}
          >
            <StickyNote className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Swap exercise"
            onClick={onSwap}
            className={`grid size-8 place-items-center rounded-sm border border-border text-text-3 transition-colors hover:bg-surface-2 hover:text-text ${RING}`}
          >
            <ArrowLeftRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 sm:px-5">
        <RecommendationBanner ex={ex} onKeepWeight={onKeepWeight} />

        <div className="divide-y divide-border-faint">
          {rows.map((row) => (
            <SetRow
              key={row.setNumber}
              row={row}
              prev={ex.prevSets[row.setNumber - 1]}
              weightStep={ex.weightIncrement === 2.5 ? 2.5 : 5}
              isBodyweight={ex.isBodyweight}
              onChange={(patch) => onPatch(row.setNumber, patch)}
              onToggle={() => onToggle(row.setNumber)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onAddSet}
          className={`mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-sm border border-border bg-transparent px-3 text-xs font-semibold text-text-2 transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text ${RING}`}
        >
          <Plus className="size-4" strokeWidth={2} />
          Add set
        </button>

        {!editMode && <div className="mt-3">
          <button
            type="button"
            disabled={done.length === 0 || coachPending}
            onClick={() => startCoachTransition(async () => {
              setCoachError(null);
              const result = await askSetCoach(ex.sessionExerciseId);
              if (result.ok) setCoachAdvice(result.advice);
              else setCoachError(result.error);
            })}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-accent-border bg-accent-muted px-3.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-text-faint ${RING}`}
          >
            <Sparkles className="size-4" strokeWidth={2} />
            {coachPending ? "Reviewing sets…" : "Ask Coach"}
          </button>
          {done.length === 0 && <span className="ml-3 text-xs text-text-3">Complete a set to ask the coach.</span>}
        </div>}

        {coachError && <p className="mt-2 text-xs text-danger">{coachError}</p>}
        {coachAdvice && (
          <div className="mt-3 rounded-sm border border-accent-border bg-accent-muted p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant={coachAdvice.action === "INCREASE" ? "success" : coachAdvice.action === "REDUCE" ? "warning" : "accent"}>{coachAdvice.action.replace("_", " ")}</Badge>
                <h3 className="mt-2 text-sm font-semibold text-text">{coachAdvice.headline}</h3>
              </div>
              {coachAdvice.nextWeight != null && done.length < rows.length && (
                <Button size="sm" variant="subtle" onClick={() => onKeepWeight(coachAdvice.nextWeight as number)}>Apply weight</Button>
              )}
            </div>
            <p className="mt-2 text-sm text-text-2">{coachAdvice.explanation}</p>
            <p className="mt-1 text-xs text-text-3">{coachAdvice.encouragement}</p>
            {coachAdvice.safetyWarning && <p className="mt-2 text-xs font-medium text-danger">{coachAdvice.safetyWarning}</p>}
            {coachAdvice.repMin != null && coachAdvice.repMax != null && <p className="mt-2 font-mono text-xs text-accent">Next set: {fmtWeight(coachAdvice.nextWeight ?? 0)} lb × {coachAdvice.repMin}{coachAdvice.repMax !== coachAdvice.repMin ? `–${coachAdvice.repMax}` : ""}</p>}
            {coachAdvice.source === "deterministic" && <p className="mt-2 text-[11px] text-text-faint">Local coaching fallback</p>}
          </div>
        )}

        {notesOpen && (
          <div className="mt-3">
            <Textarea
              placeholder="Notes for this exercise — pain, tempo, setup…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                startTransition(async () => {
                  await updateExerciseNotes(ex.sessionExerciseId, notes);
                })
              }
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-faint pt-3">
          <span className="font-mono text-xs text-text-3">
            Volume {Math.round(liveVolume).toLocaleString("en-US")} lb
            {liveE1rm > 0 ? ` · e1RM ${Math.round(liveE1rm)}` : ""}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {prs.map((pr) => (
              <PRBadge key={pr.type} type={pr.label.replace(/^PR · /, "")} />
            ))}
          </span>
        </div>
      </div>
    </Card>
  );
}

function RecapBanner({
  recap,
  onDismiss,
}: {
  recap: ExerciseRecapResponse;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-3 rounded-sm border border-accent-border bg-accent-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">{recap.headline}</h3>
            <p className="mt-1 text-sm text-text-2">{recap.message}</p>
            <p className="mt-2 text-xs font-medium text-accent">{recap.focusCue}</p>
            {recap.source === "deterministic" && (
              <p className="mt-2 text-[11px] text-text-faint">Local coaching fallback</p>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss coach feedback"
          onClick={onDismiss}
          className={`grid size-8 shrink-0 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text ${RING}`}
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function RecommendationBanner({
  ex,
  onKeepWeight,
}: {
  ex: LoggerExercise;
  onKeepWeight: (weight: number) => void;
}) {
  if (ex.recommendation === "INCREASE" && ex.targetWeight != null) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-sm border border-accent-border bg-accent-muted px-4 py-3 text-sm text-text-2">
        <TrendingUp className="size-4 shrink-0 text-accent" strokeWidth={2} />
        <span className="flex-1">
          <strong className="font-semibold text-text">
            All sets hit {ex.targetRepMax} last time.
          </strong>{" "}
          Load {fmtWeight(ex.targetWeight)} lb today.
        </span>
        {ex.prevWorkingWeight != null && (
          <button
            type="button"
            onClick={() => onKeepWeight(ex.prevWorkingWeight as number)}
            className={`inline-flex h-8 shrink-0 items-center rounded-sm border border-border bg-transparent px-3 text-xs font-semibold text-text-2 transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text ${RING}`}
          >
            Keep {fmtWeight(ex.prevWorkingWeight)}
          </button>
        )}
      </div>
    );
  }
  if (ex.recommendation === "DELOAD" && ex.targetWeight != null) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-sm border border-info/25 bg-info-muted px-4 py-3 text-sm text-text-2">
        <BatteryLow className="size-4 shrink-0 text-info" strokeWidth={2} />
        <span>
          <strong className="font-semibold text-text">Deload:</strong> half the sets at ~82.5% —
          take {fmtWeight(ex.targetWeight)} lb. Nothing near failure.
        </span>
      </div>
    );
  }
  if (ex.recommendation === "REDUCE" && ex.targetWeight != null) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-sm border border-info/25 bg-info-muted px-4 py-3 text-sm text-text-2">
        <BatteryLow className="size-4 shrink-0 text-info" strokeWidth={2} />
        <span>
          <strong className="font-semibold text-text">Back off today.</strong> Fatigue is high or
          progress stalled — take {fmtWeight(ex.targetWeight)} lb (−10%).
        </span>
      </div>
    );
  }
  if (ex.recommendation === "REPEAT" && ex.targetWeight != null) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-sm border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
        <Repeat className="size-4 shrink-0 text-text-3" strokeWidth={2} />
        <span>
          <strong className="font-semibold text-text">
            Use {fmtWeight(ex.targetWeight)} lb again
          </strong>{" "}
          — you&apos;re still working through the rep range.
        </span>
      </div>
    );
  }
  return (
    <div className="mb-3 flex items-center gap-3 rounded-sm border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
      <Flag className="size-4 shrink-0 text-text-3" strokeWidth={2} />
      <span>
        <strong className="font-semibold text-text">First session</strong> — choose a starting
        weight you could lift for ~2 more reps at the top of the range.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SwapSheet({
  ex,
  onClose,
  onSwapped,
}: {
  ex: LoggerExercise;
  onClose: () => void;
  onSwapped: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const swap = (newExerciseId: string) => {
    startTransition(async () => {
      const res = await substituteExercise({
        sessionExerciseId: ex.sessionExerciseId,
        newExerciseId,
        reason: "Swapped mid-session",
      });
      if (!res.ok) setError(res.error ?? "Swap failed.");
      else onSwapped();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-lg border border-border bg-surface p-5 shadow-[var(--shadow-raise)] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Swap {ex.name}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text ${RING}`}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-1 text-xs text-text-3">
          History stays with this slot — progression picks up right where you left off.
        </p>
        <div className="mt-4 space-y-2">
          {ex.alternatives.length === 0 && (
            <p className="rounded-sm border border-dashed border-border px-4 py-6 text-center text-xs text-text-3">
              No curated alternatives for this exercise yet.
            </p>
          )}
          {ex.alternatives.map((alt) => (
            <button
              key={alt.id}
              type="button"
              disabled={pending}
              onClick={() => swap(alt.id)}
              className={`flex w-full items-center gap-3 rounded-sm border border-border bg-surface-2 px-4 py-3 text-left text-sm font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-3 disabled:opacity-40 ${RING}`}
            >
              <ArrowLeftRight className="size-4 text-text-3" strokeWidth={2} />
              {alt.name}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
