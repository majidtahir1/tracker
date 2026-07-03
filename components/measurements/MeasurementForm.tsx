"use client";

/**
 * Monthly measurement entry — "Log measurements" button expands a form card
 * with large dark numeric inputs (DESIGN.md §3.9, §4.5).
 */
import { useActionState, useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { saveMeasurement, type ActionState } from "@/lib/actions/tracking";

const IDLE: ActionState = { ok: false };

interface FieldDef {
  name: string;
  label: string;
  unit: string;
}

const PRIMARY_FIELDS: FieldDef[] = [
  { name: "weight", label: "Body weight", unit: "lb" },
  { name: "bodyFat", label: "Body fat", unit: "%" },
  { name: "waist", label: "Waist", unit: "in" },
  { name: "chest", label: "Chest", unit: "in" },
  { name: "shoulders", label: "Shoulders", unit: "in" },
  { name: "neck", label: "Neck", unit: "in" },
];

const PAIRED_FIELDS: FieldDef[] = [
  { name: "leftArm", label: "Left arm", unit: "in" },
  { name: "rightArm", label: "Right arm", unit: "in" },
  { name: "leftForearm", label: "Left forearm", unit: "in" },
  { name: "rightForearm", label: "Right forearm", unit: "in" },
  { name: "leftThigh", label: "Left thigh", unit: "in" },
  { name: "rightThigh", label: "Right thigh", unit: "in" },
  { name: "leftCalf", label: "Left calf", unit: "in" },
  { name: "rightCalf", label: "Right calf", unit: "in" },
];

function NumericField({
  def,
  placeholder,
}: {
  def: FieldDef;
  placeholder: number | null | undefined;
}) {
  return (
    <div>
      <Label htmlFor={`m-${def.name}`}>
        {def.label} <span className="text-text-faint">({def.unit})</span>
      </Label>
      <Input
        id={`m-${def.name}`}
        name={def.name}
        numeric
        placeholder={placeholder != null ? String(placeholder) : "0.0"}
        autoComplete="off"
      />
    </div>
  );
}

export default function MeasurementForm({
  defaultDate,
  lastValues,
}: {
  defaultDate: string;
  /** Latest logged values — shown as placeholders for quick reference. */
  lastValues: Record<string, number | null> | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveMeasurement, IDLE);

  // Collapse the form after a successful save.
  useEffect(() => {
    if (state.ok && state.savedAt) setOpen(false);
  }, [state.ok, state.savedAt]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2} />
          Log measurements
        </Button>
        {state.ok && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" strokeWidth={2} /> Saved
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border-faint px-5 py-4">
        <h2 className="text-sm font-semibold text-text">Log measurements</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close form"
          className="rounded-sm p-1 text-text-3 transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
      <form action={formAction} className="p-5">
        <div className="max-w-xs">
          <Label htmlFor="m-date">Date</Label>
          <Input id="m-date" name="date" type="date" defaultValue={defaultDate} required />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          {PRIMARY_FIELDS.map((def) => (
            <NumericField key={def.name} def={def} placeholder={lastValues?.[def.name]} />
          ))}
        </div>

        <p className="mt-6 text-xs font-medium uppercase tracking-wider text-text-3">
          Girths — left / right
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
          {PAIRED_FIELDS.map((def) => (
            <NumericField key={def.name} def={def} placeholder={lastValues?.[def.name]} />
          ))}
        </div>

        <div className="mt-5">
          <Label htmlFor="m-notes">Notes</Label>
          <Textarea id="m-notes" name="notes" placeholder="Morning, fasted, post-bathroom…" />
        </div>

        {state.error && <FieldError>{state.error}</FieldError>}

        <div className="mt-5 flex gap-3">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
            {pending ? "Saving…" : "Save measurements"}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
