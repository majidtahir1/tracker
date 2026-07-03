"use client";

/** Small overlay delete control for a single progress photo. */
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePhoto } from "@/lib/actions/tracking";

export default function DeletePhotoButton({ photoId, label }: { photoId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="absolute right-1.5 top-1.5 z-10 flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deletePhoto(photoId);
            })
          }
          className="rounded-xs bg-danger-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger backdrop-blur-sm transition-colors hover:bg-danger/25 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {pending ? "…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-xs bg-bg/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-3 backdrop-blur-sm transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Delete ${label} photo`}
      onClick={() => setConfirming(true)}
      className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-xs bg-bg/70 text-text-3 backdrop-blur-sm transition-all hover:text-danger lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Trash2 className="size-3.5" strokeWidth={2} />
    </button>
  );
}
