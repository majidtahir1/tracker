/**
 * Fitbit data card (recovery page). Display-only: renders nothing unless
 * connected; connection management lives in Settings → Integrations. Shows
 * the latest day with data when the device hasn't uploaded today yet.
 */
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import type { FitbitStatus, FitbitTodaySnapshot } from "@/lib/queries/fitbit";
import { fmtDisplay } from "@/lib/dates";

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-3">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-text">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-text-3">{unit}</span>}
      </div>
    </div>
  );
}

export default function FitbitCard({
  status,
  fitbitToday,
}: {
  status: FitbitStatus;
  fitbitToday: FitbitTodaySnapshot | null;
}) {
  if (!status.configured || !status.connected) return null;

  return (
    <SectionCard title="Fitbit">
      {status.reauthRequired && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warning" strokeWidth={2} />
          <span className="font-medium text-warning">Fitbit authorization expired.</span>
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Reconnect in Settings
          </Link>
        </div>
      )}

      {fitbitToday ? (
        <div>
          {!fitbitToday.isToday && (
            <p className="mb-3 text-xs text-text-3">
              Latest data — {fmtDisplay(fitbitToday.date)}. Open the Fitbit app to sync your
              device.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Resting HR"
              value={fitbitToday.restingHr != null ? String(fitbitToday.restingHr) : "—"}
              unit={fitbitToday.restingHr != null ? "bpm" : undefined}
            />
            <Metric
              label="HRV"
              value={fitbitToday.hrvMs != null ? String(fitbitToday.hrvMs) : "—"}
              unit={fitbitToday.hrvMs != null ? "ms" : undefined}
            />
            <Metric
              label="Sleep"
              value={fitbitToday.sleepHours != null ? `${fitbitToday.sleepHours}` : "—"}
              unit={
                fitbitToday.sleepHours != null
                  ? `h${
                      fitbitToday.sleepEfficiency != null
                        ? ` · ${fitbitToday.sleepEfficiency}%`
                        : ""
                    }`
                  : undefined
              }
            />
            <Metric
              label="Steps"
              value={fitbitToday.steps != null ? fitbitToday.steps.toLocaleString("en-US") : "—"}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-3">
          No Fitbit data yet — open the Fitbit app to sync your device, or sync from{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      )}
    </SectionCard>
  );
}
