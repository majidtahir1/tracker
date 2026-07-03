"use client";

/**
 * Fast daily nutrition log (DESIGN.md §4.6): 6 numeric inputs with in-input
 * unit suffixes, prefilled with today's values for quick edits.
 */
import { useActionState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { saveNutrition, type ActionState } from "@/lib/actions/tracking";
import type { NutritionDay } from "@/lib/queries/tracking";

const IDLE: ActionState = { ok: false };

const FIELDS = [
  { name: "calories", label: "Calories", unit: "kcal", placeholder: "2800" },
  { name: "protein", label: "Protein", unit: "g", placeholder: "180" },
  { name: "carbs", label: "Carbs", unit: "g", placeholder: "300" },
  { name: "fat", label: "Fat", unit: "g", placeholder: "80" },
  { name: "fiber", label: "Fiber", unit: "g", placeholder: "35" },
  { name: "waterOz", label: "Water", unit: "oz", placeholder: "100" },
] as const;

export default function NutritionForm({ today }: { today: NutritionDay }) {
  const [state, formAction, pending] = useActionState(saveNutrition, IDLE);

  return (
    <form action={formAction}>
      <div className="max-w-xs">
        <Label htmlFor="n-date">Date</Label>
        <Input id="n-date" name="date" type="date" defaultValue={today.date} required />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <Label htmlFor={`n-${f.name}`}>{f.label}</Label>
            <div className="relative">
              <Input
                id={`n-${f.name}`}
                name={f.name}
                numeric
                className="pr-12"
                placeholder={f.placeholder}
                defaultValue={today[f.name] ?? ""}
                autoComplete="off"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-3">
                {f.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {state.error && <FieldError>{state.error}</FieldError>}

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : today.logged ? "Update today" : "Save today"}
        </Button>
      </div>
      {state.ok && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" strokeWidth={2} /> Logged.
        </p>
      )}
    </form>
  );
}
