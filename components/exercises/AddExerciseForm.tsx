"use client";

/**
 * Add-custom-exercise form. Lives behind a "Add exercise" toggle on the
 * library page; on success the server action redirects to the new detail page.
 */
import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { createExercise, type ExerciseActionState } from "@/lib/actions/exercises";
import {
  DIFFICULTY_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  TYPE_LABELS,
} from "./labels";

const INITIAL: ExerciseActionState = { ok: false };

export default function AddExerciseForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createExercise, INITIAL);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2} />
        Add exercise
      </Button>
    );
  }

  return (
    <Card className="w-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Add a custom exercise</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close form"
          className="grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" name="name" placeholder="e.g. Incline Machine Press" required />
          </div>
          <div>
            <Label htmlFor="new-primary">Primary muscle</Label>
            <Select id="new-primary" name="primaryMuscle" defaultValue="" required>
              <option value="" disabled>
                Select…
              </option>
              {Object.entries(MUSCLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-equipment">Equipment</Label>
            <Select id="new-equipment" name="equipment" defaultValue="" required>
              <option value="" disabled>
                Select…
              </option>
              {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-type">Type</Label>
            <Select id="new-type" name="type" defaultValue="" required>
              <option value="" disabled>
                Select…
              </option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-difficulty">Difficulty</Label>
            <Select id="new-difficulty" name="difficulty" defaultValue="INTERMEDIATE">
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-increment">Weight increment</Label>
            <Select id="new-increment" name="weightIncrement" defaultValue="5">
              <option value="5">5 lb (barbell / machine stack)</option>
              <option value="2.5">2.5 lb (small isolation)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="new-video">Video link (optional)</Label>
            <Input id="new-video" name="videoUrl" type="url" placeholder="https://…" />
          </div>
        </div>

        <div>
          <Label>Secondary muscles (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(MUSCLE_LABELS).map(([value, label]) => (
              <label
                key={value}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-3 transition-colors hover:border-border-strong has-checked:border-accent-border has-checked:bg-accent-muted has-checked:text-accent"
              >
                <input type="checkbox" name="secondaryMuscles" value={value} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="inline-flex items-center gap-2 text-sm text-text-2">
            <input type="checkbox" name="isBodyweight" className="size-4 accent-accent" />
            Bodyweight exercise
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-text-2">
            <input type="checkbox" name="injuryFriendly" className="size-4 accent-accent" />
            Joint-friendly
          </label>
        </div>

        <div>
          <Label htmlFor="new-notes">Notes (optional)</Label>
          <Textarea id="new-notes" name="notes" placeholder="Setup cues, seat height, grip…" />
        </div>

        {state.error && <FieldError>{state.error}</FieldError>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save exercise"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
