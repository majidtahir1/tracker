/**
 * Fitbit integration management card (settings page). Server component —
 * connect / reconnect / disconnect / sync live here; the recovery page only
 * displays synced data. Fitbit data flows via the Google Health API.
 */
import { Activity, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import FitbitSyncControls from "@/components/recovery/FitbitSyncControls";
import ConnectWearableButton from "@/components/recovery/ConnectWearableButton";
import type { FitbitStatus } from "@/lib/queries/fitbit";

export default function FitbitIntegrationCard({ status }: { status: FitbitStatus }) {
  // Env vars missing — setup explainer.
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

  // Configured but not connected — OAuth connect.
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
          <ConnectWearableButton provider="fitbit">Connect Fitbit</ConnectWearableButton>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fitbit" action={<Badge variant="success">Connected</Badge>}>
      {status.reauthRequired ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-warning">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            Fitbit authorization expired — reconnect to keep syncing.
          </span>
          <ConnectWearableButton provider="fitbit" variant="ghost" size="sm">
            Reconnect Fitbit
          </ConnectWearableButton>
        </div>
      ) : (
        <p className="text-sm text-text-2">
          Syncing resting heart rate, HRV, sleep, and steps. The latest numbers show on the
          Recovery page.
        </p>
      )}
      <FitbitSyncControls lastSyncedAt={status.lastSyncedAt} />
    </SectionCard>
  );
}
