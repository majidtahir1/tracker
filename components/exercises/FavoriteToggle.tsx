"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavorite } from "@/lib/actions/exercises";

/**
 * Favorite star. Amber when starred (volt is reserved for primary actions /
 * PR moments per DESIGN.md). Optimistic so the grid feels instant.
 */
export default function FavoriteToggle({
  exerciseId,
  isFavorite,
  size = "md",
}: {
  exerciseId: string;
  isFavorite: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticFav, setOptimisticFav] = useOptimistic(isFavorite);

  return (
    <button
      type="button"
      aria-label={optimisticFav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={optimisticFav}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          setOptimisticFav(!optimisticFav);
          await toggleFavorite(exerciseId);
        });
      }}
      className={`grid shrink-0 place-items-center rounded-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        size === "sm" ? "size-8" : "size-9"
      } ${optimisticFav ? "text-warning" : "text-text-faint hover:text-text-3"}`}
    >
      <Star
        className={size === "sm" ? "size-4" : "size-[18px]"}
        strokeWidth={2}
        fill={optimisticFav ? "currentColor" : "none"}
      />
    </button>
  );
}
