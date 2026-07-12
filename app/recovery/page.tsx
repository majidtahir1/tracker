import Link from "next/link";
import { BatteryLow, ChartLine, Watch } from "lucide-react";
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

export default async function RecoveryPage() {
  await Promise.all([maybeAutoSync().catch(() => {}), maybeAutoSyncFitbit().catch(() => {})]);

  const today = localToday();
  const [whoopStatus, fitbitStatus, fitbitToday, data] = await Promise.all([
    getWhoopStatus(),
    getFitbitStatus(),
    getFitbitToday(),
    getRecoveryData(today),
  ]);

  const whoopConnected = whoopStatus.configured && whoopStatus.connected;
  const fitbitConnected = fitbitStatus.configured && fitbitStatus.connected;
  const hasTrendData = data.trend.some((p) => p.score != null);
  const trendHasWhoop = data.trend.some((p) => p.source === "whoop");

  return (
    <div className="space-y-8">
      <PageHeader title="Recovery" subtitle="Daily check-in and 0–100 recovery score." />

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

      {!whoopConnected && !fitbitConnected && (
        <div className="flex items-center gap-3 rounded-sm border border-dashed border-border px-4 py-3 text-sm text-text-3">
          <Watch className="size-4 shrink-0" strokeWidth={2} />
          <span>
            Wear a WHOOP or Fitbit?{" "}
            <Link href="/settings" className="font-medium text-accent hover:underline">
              Connect it in Settings
            </Link>{" "}
            to sync recovery data automatically.
          </span>
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
