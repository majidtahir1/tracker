/**
 * /settings — app settings. First section: Integrations (WHOOP, Fitbit) —
 * connection management lives here; the recovery page only displays data.
 * OAuth callbacks land back here with ?whoop= / ?fitbit= status params.
 */
import { CheckCircle2, CircleAlert } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import WhoopIntegrationCard from "@/components/settings/WhoopIntegrationCard";
import FitbitIntegrationCard from "@/components/settings/FitbitIntegrationCard";
import NotificationSettingsCard from "@/components/settings/NotificationSettingsCard";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getWhoopStatus, maybeAutoSync } from "@/lib/queries/whoop";
import { getFitbitStatus, maybeAutoSyncFitbit } from "@/lib/queries/fitbit";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function notices(provider: string): Record<string, { tone: "success" | "danger"; text: string }> {
  return {
    connected: { tone: "success", text: `${provider} connected — syncing your data now.` },
    denied: { tone: "danger", text: `${provider} connection was denied — authorize access to sync.` },
    state_mismatch: {
      tone: "danger",
      text: `${provider} connection failed a security check (state mismatch). Try connecting again.`,
    },
    not_configured: {
      tone: "danger",
      text: `${provider} isn't configured — set the env vars below, then connect.`,
    },
    error: { tone: "danger", text: `${provider} connection failed — try again.` },
  };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ whoop?: string; fitbit?: string }>;
}) {
  await Promise.all([maybeAutoSync().catch(() => {}), maybeAutoSyncFitbit().catch(() => {})]);

  const userId = await requireUserId();
  const [{ whoop: whoopParam, fitbit: fitbitParam }, whoopStatus, fitbitStatus, appSettings, deviceCount] =
    await Promise.all([
      searchParams,
      getWhoopStatus(),
      getFitbitStatus(),
      prisma.appSettings.findUnique({
        where: { userId },
        select: { notifyMorningBrief: true, notifyStreakSaver: true },
      }),
      prisma.pushToken.count({ where: { userId } }),
    ]);

  const notice =
    (whoopParam ? (notices("WHOOP")[whoopParam] ?? null) : null) ??
    (fitbitParam ? (notices("Fitbit")[fitbitParam] ?? null) : null);

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Integrations and app configuration." />

      {notice && (
        <div
          className={`flex items-center gap-3 rounded-sm border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-success/25 bg-success-muted text-success"
              : "border-danger/25 bg-danger-muted text-danger"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="size-5 shrink-0" strokeWidth={2} />
          ) : (
            <CircleAlert className="size-5 shrink-0" strokeWidth={2} />
          )}
          <span className="font-medium">{notice.text}</span>
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-text-3">
            Wearables sync automatically as you use the app; the latest numbers show on the
            Recovery page.
          </p>
        </div>
        <WhoopIntegrationCard status={whoopStatus} />
        <FitbitIntegrationCard status={fitbitStatus} />
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-text-3">Push notifications to the iOS app.</p>
        </div>
        <SectionCard title="Push notifications">
          <NotificationSettingsCard
            initial={{
              notifyMorningBrief: appSettings?.notifyMorningBrief ?? true,
              notifyStreakSaver: appSettings?.notifyStreakSaver ?? true,
            }}
            deviceRegistered={deviceCount > 0}
          />
        </SectionCard>
      </section>
    </div>
  );
}
