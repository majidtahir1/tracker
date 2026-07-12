/**
 * WHOOP integration management card (settings page). Server component —
 * connect / reconnect / disconnect / sync live here; the recovery page only
 * displays synced data.
 */
import { Activity, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import WhoopSyncControls from "@/components/recovery/WhoopSyncControls";
import ConnectWearableButton from "@/components/recovery/ConnectWearableButton";
import type { WhoopStatus } from "@/lib/queries/whoop";

export default function WhoopIntegrationCard({ status }: { status: WhoopStatus }) {
  // Env vars missing — setup explainer.
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

  // Configured but not connected — OAuth connect.
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

  return (
    <SectionCard title="WHOOP" action={<Badge variant="success">Connected</Badge>}>
      {status.reauthRequired ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/25 bg-warning-muted px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-warning">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            WHOOP authorization expired — reconnect to keep syncing.
          </span>
          <ConnectWearableButton provider="whoop" variant="ghost" size="sm">
            Reconnect WHOOP
          </ConnectWearableButton>
        </div>
      ) : (
        <p className="text-sm text-text-2">
          Syncing recovery, HRV, sleep, and strain. Today&rsquo;s numbers show on the Recovery
          page and feed the daily score.
        </p>
      )}
      <WhoopSyncControls lastSyncedAt={status.lastSyncedAt} />
    </SectionCard>
  );
}
