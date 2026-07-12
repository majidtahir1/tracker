/**
 * WHOOP integration card (recovery page). Server component — renders one of:
 * not configured / not connected / reauth required / connected with today's
 * metrics / connected but no data yet. Sync footer is a client island.
 */
import { Activity, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import WhoopSyncControls from "@/components/recovery/WhoopSyncControls";
import ConnectWearableButton from "@/components/recovery/ConnectWearableButton";
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
  // a. Env vars missing — setup explainer.
  if (!status.configured) {
    return (
      <SectionCard title="WHOOP">
        <p className="text-sm text-text-2">
          Pull recovery, HRV, sleep, and strain straight from your WHOOP. Register a free app at{" "}
          <a
            href="https://developer.whoop.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            developer.whoop.com
          </a>
          , then set these in <code className="rounded-xs bg-surface-2 px-1 py-0.5 text-xs">.env</code>:
        </p>
        <ul className="mt-3 space-y-1 font-mono text-xs text-text-3">
          <li>WHOOP_CLIENT_ID</li>
          <li>WHOOP_CLIENT_SECRET</li>
          <li>WHOOP_REDIRECT_URI</li>
        </ul>
        <p className="mt-3 text-xs text-text-3">
          The redirect URI must exactly match the one on your WHOOP app — e.g.{" "}
          <code className="rounded-xs bg-surface-2 px-1 py-0.5">
            http://localhost:3000/api/whoop/callback
          </code>
          .
        </p>
      </SectionCard>
    );
  }

  // b. Configured but not connected — OAuth connect.
  if (!status.connected) {
    return (
      <SectionCard title="WHOOP">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 size-5 shrink-0 text-text-3" strokeWidth={2} />
            <p className="max-w-prose text-sm text-text-2">
              Connect your WHOOP to sync recovery, HRV, resting heart rate, sleep, and day strain
              automatically. WHOOP recovery takes over the daily score; manual check-ins stay as a
              fallback.
            </p>
          </div>
          <ConnectWearableButton provider="whoop">Connect WHOOP</ConnectWearableButton>
        </div>
      </SectionCard>
    );
  }

  const score = whoopToday?.score ?? null;

  return (
    <SectionCard
      title="WHOOP"
      action={<Badge variant="success">Connected</Badge>}
    >
      {/* e. Token expired/revoked — reconnect banner. */}
      {status.reauthRequired && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-warning">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            WHOOP authorization expired — reconnect to keep syncing.
          </span>
          <ConnectWearableButton provider="whoop" variant="ghost" size="sm">
            Reconnect WHOOP
          </ConnectWearableButton>
        </div>
      )}

      {whoopToday ? (
        /* c. Connected with today's data — metrics grid. */
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
        /* d. Connected but nothing synced for today yet. */
        <p className="text-sm text-text-3">
          No WHOOP data for today yet — sync or check back after your recovery calculates.
        </p>
      )}

      <WhoopSyncControls lastSyncedAt={status.lastSyncedAt} />
    </SectionCard>
  );
}
