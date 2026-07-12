/**
 * WHOOP data card (recovery page). Display-only: renders nothing unless
 * connected; connection management lives in Settings → Integrations.
 */
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import type { WhoopStatus } from "@/lib/queries/whoop";
import type { WhoopTodaySnapshot } from "@/lib/queries/tracking";

const SCORE_BANDS = {
  recovered: { text: "text-success", ring: "border-success" },
  manage: { text: "text-warning", ring: "border-warning" },
  fatigued: { text: "text-danger", ring: "border-danger" },
} as const;

function scoreBand(score: number) {
  if (score >= 70) return SCORE_BANDS.recovered;
  if (score >= 40) return SCORE_BANDS.manage;
  return SCORE_BANDS.fatigued;
}

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

export default function WhoopCard({
  status,
  whoopToday,
}: {
  status: WhoopStatus;
  whoopToday: WhoopTodaySnapshot | null;
}) {
  if (!status.configured || !status.connected) return null;

  const score = whoopToday?.score ?? null;

  return (
    <SectionCard title="WHOOP">
      {status.reauthRequired && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warning" strokeWidth={2} />
          <span className="font-medium text-warning">WHOOP authorization expired.</span>
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Reconnect in Settings
          </Link>
        </div>
      )}

      {whoopToday ? (
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`grid size-20 shrink-0 place-items-center rounded-full border-4 ${
                score != null ? scoreBand(score).ring : "border-border"
              }`}
            >
              <span
                className={`font-display text-3xl font-semibold tabular-nums ${
                  score != null ? scoreBand(score).text : "text-text-faint"
                }`}
              >
                {score ?? "—"}
              </span>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-text-3">
                Recovery
              </div>
              <div className="mt-0.5 text-xs text-text-3">
                {whoopToday.calibrating
                  ? "Calibrating — WHOOP needs a few more days of data."
                  : "Today, via WHOOP."}
              </div>
            </div>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="HRV"
              value={whoopToday.hrvMs != null ? String(whoopToday.hrvMs) : "—"}
              unit={whoopToday.hrvMs != null ? "ms" : undefined}
            />
            <Metric
              label="Resting HR"
              value={whoopToday.restingHr != null ? String(whoopToday.restingHr) : "—"}
              unit={whoopToday.restingHr != null ? "bpm" : undefined}
            />
            <Metric
              label="Sleep"
              value={whoopToday.sleepHours != null ? `${whoopToday.sleepHours}` : "—"}
              unit={
                whoopToday.sleepHours != null
                  ? `h${
                      whoopToday.sleepPerformancePct != null
                        ? ` · ${whoopToday.sleepPerformancePct}%`
                        : ""
                    }`
                  : undefined
              }
            />
            <Metric
              label="Day strain"
              value={whoopToday.dayStrain != null ? whoopToday.dayStrain.toFixed(1) : "—"}
              unit={whoopToday.dayStrain != null ? "/ 21" : undefined}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-3">
          No WHOOP data for today yet — check back after your recovery calculates, or sync from{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      )}
    </SectionCard>
  );
}
