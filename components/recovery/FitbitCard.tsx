/**
 * Fitbit integration card (recovery page). Server component — renders one of:
 * not configured / not connected / reauth required / connected with today's
 * metrics / connected but no data yet. Sync footer is a client island.
 * Unlike WHOOP, Fitbit has no recovery score — manual check-ins still drive
 * the daily 0–100 score; this card is context (RHR, HRV, sleep, steps).
 */
import { Activity, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import FitbitSyncControls from "@/components/recovery/FitbitSyncControls";
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
  // a. Env vars missing — setup explainer.
  if (!status.configured) {
    return (
      <SectionCard title="Fitbit">
        <p className="text-sm text-text-2">
          Pull resting heart rate, HRV, sleep, and activity from your Fitbit via the{" "}
          <a
            href="https://developers.google.com/health"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Google Health API
          </a>
          . Create an OAuth client in the Google Cloud Console (enable the Health API; add
          yourself as a test user), then set these in{" "}
          <code className="rounded-xs bg-surface-2 px-1 py-0.5 text-xs">.env</code>:
        </p>
        <ul className="mt-3 space-y-1 font-mono text-xs text-text-3">
          <li>GOOGLE_HEALTH_CLIENT_ID</li>
          <li>GOOGLE_HEALTH_CLIENT_SECRET</li>
          <li>GOOGLE_HEALTH_REDIRECT_URI</li>
        </ul>
        <p className="mt-3 text-xs text-text-3">
          The redirect URI must exactly match the one on your OAuth client — e.g.{" "}
          <code className="rounded-xs bg-surface-2 px-1 py-0.5">
            http://localhost:3000/api/fitbit/callback
          </code>
          .
        </p>
      </SectionCard>
    );
  }

  // b. Configured but not connected — OAuth connect.
  if (!status.connected) {
    return (
      <SectionCard title="Fitbit">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 size-5 shrink-0 text-text-3" strokeWidth={2} />
            <p className="max-w-prose text-sm text-text-2">
              Connect your Fitbit to sync resting heart rate, HRV, sleep, and activity
              automatically. Manual check-ins keep driving the daily recovery score.
            </p>
          </div>
          <a href="/api/fitbit/auth" className={buttonClasses("primary", "md")}>
            Connect Fitbit
          </a>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fitbit" action={<Badge variant="success">Connected</Badge>}>
      {/* e. Token expired/revoked — reconnect banner. */}
      {status.reauthRequired && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-warning">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            Fitbit authorization expired — reconnect to keep syncing.
          </span>
          <a href="/api/fitbit/auth" className={buttonClasses("ghost", "sm")}>
            Reconnect Fitbit
          </a>
        </div>
      )}

      {fitbitToday ? (
        /* c. Connected with data — metrics grid (latest day when today is empty). */
        <div>
          {!fitbitToday.isToday && (
            <p className="mb-3 text-xs text-text-3">
              Latest data — {fmtDisplay(fitbitToday.date)}. Open the Fitbit app to sync your
              device, then sync here.
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
        /* d. Connected but nothing synced for today yet. */
        <p className="text-sm text-text-3">
          No Fitbit data for today yet — sync or check back after your Fitbit uploads.
        </p>
      )}

      <FitbitSyncControls lastSyncedAt={status.lastSyncedAt} />
    </SectionCard>
  );
}
