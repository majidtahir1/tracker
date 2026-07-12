"use client";

/**
 * Fitbit card footer: last-synced relative time, "Sync now" (forces a sync
 * via server action), and a small "Disconnect" with a confirm().
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Unplug } from "lucide-react";
import Button from "@/components/ui/Button";
import { disconnectFitbit, syncFitbitNow } from "@/lib/actions/fitbit";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export default function FitbitSyncControls({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const syncNow = () => {
    setError(null);
    startTransition(async () => {
      const result = await syncFitbitNow();
      if (!result.ok) setError(result.error ?? "Sync failed.");
      router.refresh();
    });
  };

  const disconnect = () => {
    if (!window.confirm("Disconnect Fitbit? Already-synced data is kept.")) return;
    setError(null);
    startTransition(async () => {
      await disconnectFitbit();
      router.refresh();
    });
  };

  return (
    <div className="mt-4 border-t border-border-faint pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={syncNow} disabled={pending}>
          <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={2} />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
        <span className="text-xs text-text-3">
          {lastSyncedAt ? `Synced ${relativeTime(lastSyncedAt)}` : "Never synced"}
        </span>
        <button
          type="button"
          onClick={disconnect}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
        >
          <Unplug className="size-3.5" strokeWidth={2} />
          Disconnect
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">Sync error: {error}</p>}
    </div>
  );
}
