import { BatteryLow, ChartLine, CheckCircle2, CircleAlert } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/Card";
import ChartCard from "@/components/ui/ChartCard";
import RecoveryForm from "@/components/recovery/RecoveryForm";
import RecoveryTrendChart from "@/components/recovery/RecoveryTrendChart";
import WhoopCard from "@/components/recovery/WhoopCard";
import FitbitCard from "@/components/recovery/FitbitCard";
import { getRecoveryData } from "@/lib/queries/tracking";
import { getWhoopStatus, maybeAutoSync } from "@/lib/queries/whoop";
import { getFitbitStatus, getFitbitToday, maybeAutoSyncFitbit } from "@/lib/queries/fitbit";
import { fmtDisplay, localToday } from "@/lib/dates";

export const metadata = { title: "Recovery" };
export const dynamic = "force-dynamic";

const WHOOP_NOTICES: Record<string, { tone: "success" | "danger"; text: string }> = {
  connected: { tone: "success", text: "WHOOP connected — syncing your recovery data now." },
  denied: { tone: "danger", text: "WHOOP connection was denied — authorize access to sync." },
  state_mismatch: {
    tone: "danger",
    text: "WHOOP connection failed a security check (state mismatch). Try connecting again.",
  },
  not_configured: {
    tone: "danger",
    text: "WHOOP isn't configured — set the env vars below, then connect.",
  },
  error: { tone: "danger", text: "WHOOP connection failed — try again." },
};

const FITBIT_NOTICES: Record<string, { tone: "success" | "danger"; text: string }> = {
  connected: { tone: "success", text: "Fitbit connected — syncing your data now." },
  denied: { tone: "danger", text: "Fitbit connection was denied — authorize access to sync." },
  state_mismatch: {
    tone: "danger",
    text: "Fitbit connection failed a security check (state mismatch). Try connecting again.",
  },
  not_configured: {
    tone: "danger",
    text: "Fitbit isn't configured — set the env vars below, then connect.",
  },
  error: { tone: "danger", text: "Fitbit connection failed — try again." },
};

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ whoop?: string; fitbit?: string }>;
}) {
  await Promise.all([maybeAutoSync().catch(() => {}), maybeAutoSyncFitbit().catch(() => {})]);

  const today = localToday();
  const [{ whoop: whoopParam, fitbit: fitbitParam }, whoopStatus, fitbitStatus, fitbitToday, data] =
    await Promise.all([
      searchParams,
      getWhoopStatus(),
      getFitbitStatus(),
      getFitbitToday(),
      getRecoveryData(today),
    ]);

  const notice =
    (whoopParam ? (WHOOP_NOTICES[whoopParam] ?? null) : null) ??
    (fitbitParam ? (FITBIT_NOTICES[fitbitParam] ?? null) : null);
  const whoopConnected = whoopStatus.configured && whoopStatus.connected;
  const hasTrendData = data.trend.some((p) => p.score != null);
  const trendHasWhoop = data.trend.some((p) => p.source === "whoop");

  return (
    <div className="space-y-8">
      <PageHeader title="Recovery" subtitle="Daily check-in and 0–100 recovery score." />

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

      {data.latestBand === "fatigued" && data.latestScore != null && (
        <div className="flex items-center gap-3 rounded-sm border border-danger/25 bg-danger-muted px-4 py-3 text-sm">
          <BatteryLow className="size-5 shrink-0 text-danger" strokeWidth={2} />
          <div>
            <span className="font-semibold text-danger">
              Recovery is low — {data.latestScore}/100
              {data.latestScoreDate ? ` on ${fmtDisplay(data.latestScoreDate)}` : ""}
              {data.latestSource === "whoop" ? " via WHOOP" : ""}.
            </span>{" "}
            <span className="text-text-2">
              Progression recommendations flip to REDUCE below 40. Sleep first, lift lighter today.
            </span>
          </div>
        </div>
      )}

      <WhoopCard status={whoopStatus} whoopToday={data.whoopToday} />

      <FitbitCard status={fitbitStatus} fitbitToday={fitbitToday} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title={
            whoopConnected
              ? data.today
                ? "Manual check-in — edit"
                : "Manual check-in"
              : data.today
                ? "Today's check-in — edit"
                : "Today's check-in"
          }
        >
          {whoopConnected && (
            <p className="mb-4 text-xs text-text-3">
              Manual fallback — used on days without WHOOP data.
            </p>
          )}
          <RecoveryForm date={today} initial={data.today} />
        </SectionCard>

        <div className="space-y-5">
          <ChartCard
            title="Score — last 14 days"
            legend={[{ label: "Recovery score", colorVar: "--color-chart-6" }]}
            action={
              trendHasWhoop ? (
                <span className="text-xs text-text-3">Includes WHOOP recovery where available</span>
              ) : undefined
            }
          >
            {hasTrendData ? (
              <RecoveryTrendChart data={data.trend} />
            ) : (
              <EmptyState
                chart
                icon={ChartLine}
                title="No check-ins yet."
                body="Sleep, stress, energy, soreness — 30 seconds a day keeps the load honest."
              />
            )}
          </ChartCard>

          <SectionCard title="How the score works">
            <ul className="space-y-2 text-xs text-text-3">
              <li>
                <span className="font-semibold text-text-2">Sleep hours carry the most weight (25%)</span>{" "}
                — 8 hours scores full marks.
              </li>
              <li>
                Sleep quality, stress, energy, and soreness are 15% each; motivation 10%; yesterday&apos;s
                workout difficulty 5%.
              </li>
              <li>
                <span className="text-success">70+</span> recovered ·{" "}
                <span className="text-warning">40–69</span> manage load ·{" "}
                <span className="text-danger">&lt;40</span> fatigue warning — the progression engine
                backs loads off ~10% until you bounce back.
              </li>
              <li>Skip a question and its weight redistributes — answer what you know.</li>
              {whoopConnected && (
                <li>On days with a synced WHOOP recovery, the WHOOP score is used instead.</li>
              )}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
