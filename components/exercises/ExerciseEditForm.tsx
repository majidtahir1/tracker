"use client";

/**
 * Detail-page edit form: notes, video link, favorite, injury-friendly.
 */
import { useActionState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { updateExercise, type ExerciseActionState } from "@/lib/actions/exercises";

const INITIAL: ExerciseActionState = { ok: false };

export default function ExerciseEditForm({
  exercise,
}: {
  exercise: {
    id: string;
    notes: string | null;
    videoUrl: string | null;
    isFavorite: boolean;
    injuryFriendly: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(updateExercise, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={exercise.id} />
      <div>
        <Label htmlFor="edit-video">Video link</Label>
        <Input
          id="edit-video"
          name="videoUrl"
          type="url"
          defaultValue={exercise.videoUrl ?? ""}
          placeholder="https://…"
        />
      </div>
      <div>
        <Label htmlFor="edit-notes">Notes</Label>
        <Textarea
          id="edit-notes"
          name="notes"
          defaultValue={exercise.notes ?? ""}
          placeholder="Setup cues, seat height, grip width…"
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-text-2">
          <input
            type="checkbox"
            name="isFavorite"
            defaultChecked={exercise.isFavorite}
            className="size-4 accent-accent"
          />
          Favorite
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-text-2">
          <input
            type="checkbox"
            name="injuryFriendly"
            defaultChecked={exercise.injuryFriendly}
            className="size-4 accent-accent"
          />
          Joint-friendly
        </label>
      </div>

      {state.error && <FieldError>{state.error}</FieldError>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state.ok && !pending && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" strokeWidth={2} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
