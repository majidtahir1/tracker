"use client";

/**
 * Goals page body: goal rows with thick progress bars, create/edit form,
 * delete, and achieved-state celebration styling.
 */
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Dumbbell,
  Pencil,
  Percent,
  Plus,
  Ruler,
  Scale,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, SectionCard } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import ProgressBar from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { deleteGoal, saveGoal, type GoalActionState } from "@/lib/actions/goals";
import type { GoalView } from "@/lib/queries/goals";
import type { GoalType } from "@/lib/generated/prisma/enums";
import { GOAL_TYPE_META, MEASUREMENT_FIELD_LABELS, goalKey } from "./goal-meta";

const INITIAL: GoalActionState = { ok: false };

const GOAL_ICONS: Record<GoalType, LucideIcon> = {
  BODY_WEIGHT: Scale,
  BODY_FAT: Percent,
  BENCH_1RM: Dumbbell,
  SQUAT_1RM: Dumbbell,
  DEADLIFT_1RM: Dumbbell,
  SHOULDER_PRESS_1RM: Dumbbell,
  MEASUREMENT: Ruler,
};

function fmtVal(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1).replace(/\.0$/, "");
}

// ---------- Form ----------

function GoalForm({
  editing,
  currentValues,
  onClose,
}: {
  editing: GoalView | null;
  /** Derived current values keyed by goal key, for start-value prefill. */
  currentValues: Record<string, number>;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveGoal, INITIAL);
  const [type, setType] = useState<GoalType>(editing?.type ?? "BODY_WEIGHT");
  const [field, setField] = useState<string>(editing?.measurementField ?? "waist");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const key = goalKey(type, type === "MEASUREMENT" ? field : null);
  const derived = currentValues[key];
  const startDefault = editing?.startValue ?? derived;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">
          {editing ? `Edit goal — ${editing.label}` : "New goal"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close goal form"
          className="grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="goal-type">Goal</Label>
            <Select
              id="goal-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              disabled={!!editing}
            >
              {(Object.keys(GOAL_TYPE_META) as GoalType[]).map((t) => (
                <option key={t} value={t}>
                  {t === "MEASUREMENT" ? "Body measurement" : GOAL_TYPE_META[t].label}
                </option>
              ))}
            </Select>
            {editing && <input type="hidden" name="type" value={type} />}
          </div>
          {type === "MEASUREMENT" && (
            <div>
              <Label htmlFor="goal-field">Measurement</Label>
              <Select
                id="goal-field"
                name="measurementField"
                value={field}
                onChange={(e) => setField(e.target.value)}
                disabled={!!editing}
              >
                {Object.entries(MEASUREMENT_FIELD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {editing && <input type="hidden" name="measurementField" value={field} />}
            </div>
          )}
          <div>
            <Label htmlFor="goal-start">
              Starting value ({type === "MEASUREMENT" ? "in" : GOAL_TYPE_META[type].unit})
            </Label>
            <Input
              id="goal-start"
              name="startValue"
              numeric
              key={`start-${key}-${editing?.id ?? "new"}`}
              defaultValue={startDefault != null ? String(startDefault) : ""}
              placeholder={derived != null ? String(derived) : "0"}
              required
            />
            {derived != null && !editing && (
              <p className="mt-1.5 text-xs text-text-faint">
                Latest tracked value: {fmtVal(derived)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="goal-target">
              Target value ({type === "MEASUREMENT" ? "in" : GOAL_TYPE_META[type].unit})
            </Label>
            <Input
              id="goal-target"
              name="targetValue"
              numeric
              defaultValue={editing ? String(editing.targetValue) : ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input
              id="goal-date"
              name="targetDate"
              type="date"
              defaultValue={editing?.targetDate ?? ""}
            />
          </div>
        </div>

        {state.error && <FieldError>{state.error}</FieldError>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save goal" : "Set goal"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------- Row ----------

function GoalRow({
  goal,
  onEdit,
}: {
  goal: GoalView;
  onEdit: () => void;
}) {
  const [deleting, startDelete] = useTransition();
  const Icon = GOAL_ICONS[goal.type];
  const hasData = goal.currentValue != null;

  return (
    <div className={`px-5 py-4 ${goal.achieved ? "bg-success-muted/50" : ""}`}>
      <div className="flex items-center gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-sm ${
            goal.achieved ? "bg-success-muted text-success" : "bg-surface-2 text-text-3"
          }`}
        >
          {goal.achieved ? (
            <Trophy className="size-4" strokeWidth={2} />
          ) : (
            <Icon className="size-4" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">{goal.label}</span>
            {goal.achieved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success animate-pr-pop">
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
                ACHIEVED
              </span>
            )}
            {!goal.achieved && goal.behindPace && <Badge variant="warning">BEHIND PACE</Badge>}
          </div>
        </div>
        <span className="text-sm tabular-nums text-text-2">
          {hasData ? fmtVal(goal.currentValue as number) : "—"}
          <span className="text-text-3"> / {fmtVal(goal.targetValue)} {goal.unit}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${goal.label} goal`}
            className="grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Pencil className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => startDelete(async () => void (await deleteGoal(goal.id)))}
            aria-label={`Delete ${goal.label} goal`}
            className="grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Trash2 className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="mt-3 pl-11">
        <ProgressBar pct={goal.pct} thick behindPace={goal.behindPace} />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-text-faint tabular-nums">
            {hasData
              ? `started at ${fmtVal(goal.startValue)} ${goal.unit} · ${fmtVal(goal.pct)}%`
              : "no data yet — log a measurement or session to start tracking"}
          </span>
          {goal.projection && (
            <span className="text-[11px] text-text-faint">{goal.projection}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Manager ----------

export default function GoalsManager({
  goals,
  currentValues,
}: {
  goals: GoalView[];
  currentValues: Record<string, number>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(
    () => goals.find((g) => g.id === editingId) ?? null,
    [goals, editingId]
  );

  const achievedCount = goals.filter((g) => g.achieved).length;
  const close = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-3 tabular-nums">
          {goals.length === 0
            ? "No goals yet"
            : `${achievedCount} of ${goals.length} goals achieved`}
        </p>
        {!formOpen && !editing && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" strokeWidth={2} />
            New goal
          </Button>
        )}
      </div>

      {(formOpen || editing) && (
        <GoalForm editing={editing} currentValues={currentValues} onClose={close} />
      )}

      {goals.length === 0 ? (
        !formOpen && (
          <EmptyState
            icon={Target}
            title="No goals set."
            body="Pick a number and a date — body weight, a big-4 e1RM, or a tape measurement. Progress bars keep the score."
            cta={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" strokeWidth={2} />
                Set your first goal
              </Button>
            }
          />
        )
      ) : (
        <SectionCard title="Current vs goal" flush>
          <div className="divide-y divide-border-faint">
            {goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onEdit={() => {
                  setEditingId(goal.id);
                  setFormOpen(false);
                }}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
