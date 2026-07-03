"use client";

/**
 * Library grid with in-memory search + filters. The full library is small
 * (~30 rows) and arrives pre-shaped from the server; filtering stays client-
 * side for instant feedback.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import type { ExerciseListItem } from "@/lib/queries/exercises";
import type { Equipment, MuscleGroup } from "@/lib/generated/prisma/enums";
import {
  DIFFICULTY_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  TYPE_LABELS,
} from "./labels";
import FavoriteToggle from "./FavoriteToggle";

export default function ExerciseLibrary({ exercises }: { exercises: ExerciseListItem[] }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<"" | MuscleGroup>("");
  const [equipment, setEquipment] = useState<"" | Equipment>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [injuryOnly, setInjuryOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (muscle && e.primaryMuscle !== muscle && !e.secondaryMuscles.includes(muscle)) {
        return false;
      }
      if (equipment && e.equipment !== equipment) return false;
      if (favoritesOnly && !e.isFavorite) return false;
      if (injuryOnly && !e.injuryFriendly) return false;
      return true;
    });
  }, [exercises, query, muscle, equipment, favoritesOnly, injuryOnly]);

  const toggleChip = (active: boolean) =>
    `inline-flex h-12 items-center gap-1.5 rounded-sm border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
      active
        ? "border-accent-border bg-accent-muted text-accent"
        : "border-border bg-surface-2 text-text-3 hover:border-border-strong hover:text-text-2"
    }`;

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" strokeWidth={2} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="pl-10"
            aria-label="Search exercises"
          />
        </div>
        <div className="w-44">
          <Select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value as "" | MuscleGroup)}
            aria-label="Filter by muscle group"
          >
            <option value="">All muscles</option>
            {Object.entries(MUSCLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as "" | Equipment)}
            aria-label="Filter by equipment"
          >
            <option value="">All equipment</option>
            {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          className={toggleChip(favoritesOnly)}
          onClick={() => setFavoritesOnly((v) => !v)}
          aria-pressed={favoritesOnly}
        >
          <Star className="size-4" strokeWidth={2} fill={favoritesOnly ? "currentColor" : "none"} />
          Favorites
        </button>
        <button
          type="button"
          className={toggleChip(injuryOnly)}
          onClick={() => setInjuryOnly((v) => !v)}
          aria-pressed={injuryOnly}
        >
          <ShieldCheck className="size-4" strokeWidth={2} />
          Joint-friendly
        </button>
      </div>

      <p className="text-xs text-text-3 tabular-nums">
        {filtered.length} of {exercises.length} exercises
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-16 text-center">
          <Search className="size-10 text-text-faint" strokeWidth={1.75} />
          <p className="mt-4 text-sm font-semibold text-text">Nothing matches those filters.</p>
          <p className="mt-1 max-w-xs text-xs text-text-3">
            Clear a filter or two — every movement in the program is in here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="relative rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-border-strong"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/exercises/${e.id}`}
                  className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-xs"
                >
                  <span className="absolute inset-0" aria-hidden />
                  <span className="block truncate text-sm font-semibold text-text">{e.name}</span>
                </Link>
                <span className="relative z-10 -mr-2 -mt-2">
                  <FavoriteToggle exerciseId={e.id} isFavorite={e.isFavorite} size="sm" />
                </span>
              </div>
              <p className="mt-1 text-xs text-text-3">
                {MUSCLE_LABELS[e.primaryMuscle]}
                {e.secondaryMuscles.length > 0 && (
                  <span className="text-text-faint">
                    {" "}
                    · {e.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-text-faint">
                {EQUIPMENT_LABELS[e.equipment]} · {TYPE_LABELS[e.type]} ·{" "}
                {DIFFICULTY_LABELS[e.difficulty]}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {e.injuryFriendly && (
                  <Badge variant="info">
                    <ShieldCheck className="size-3" strokeWidth={2} />
                    JOINT-FRIENDLY
                  </Badge>
                )}
                {e.isBodyweight && <Badge variant="neutral">BODYWEIGHT</Badge>}
                {e.slotCount === 0 && <Badge variant="neutral">NOT PROGRAMMED</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
