import { ChartLine, Flame, Gauge, HeartPulse, Scale, TrendingUp } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ChartCard from "@/components/ui/ChartCard";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { ButtonLink } from "@/components/ui/Button";
import AnalyticsRangeToggle from "@/components/analytics/AnalyticsRangeToggle";
import E1rmChart from "@/components/analytics/E1rmChart";
import ExerciseE1rmExplorer from "@/components/analytics/ExerciseE1rmExplorer";
import WeeklyMuscleVolumeChart from "@/components/analytics/WeeklyMuscleVolumeChart";
import AvgRirChart from "@/components/analytics/AvgRirChart";
import RecoveryPerformanceChart from "@/components/analytics/RecoveryPerformanceChart";
import BodyWeightChart from "@/components/analytics/BodyWeightChart";
import FrequencyStrip from "@/components/analytics/FrequencyStrip";
import WhoopRecoveryChart from "@/components/analytics/WhoopRecoveryChart";
import WhoopSleepChart from "@/components/analytics/WhoopSleepChart";
import WhoopStrainChart from "@/components/analytics/WhoopStrainChart";
import { getAnalyticsData, parseAnalyticsRange, VOLUME_REGIONS } from "@/lib/queries/analytics";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

/** Big-four series colors: chart-1/3/4/5 per DESIGN.md §4.1. */
const BIG_FOUR_COLORS = ["#A3E635", "#F472B6", "#FBBF24", "#818CF8"];

const VOLUME_LEGEND = [
  { label: "Chest", colorVar: "--color-chart-3" },
  { label: "Back", colorVar: "--color-chart-4" },
  { label: "Shoulders", colorVar: "--color-chart-2" },
  { label: "Arms", colorVar: "--color-chart-6" },
  { label: "Legs", colorVar: "--color-chart-5" },
  { label: "Core", colorVar: "--color-chart-1" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const data = await getAnalyticsData(range);

  const chartEmpty = (body: string) => (
    <EmptyState chart icon={ChartLine} title="Not enough data yet." body={body} />
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Strength, volume, consistency, and recovery trends."
        actions={<AnalyticsRangeToggle active={range} />}
      />

      {!data.hasSessions && (
        <EmptyState
          icon={ChartLine}
          title="No completed sessions in this range."
          body="Charts light up after your first logged workout. First session's the baseline — the big-four e1RM lines start there."
          cta={
            <ButtonLink href="/workout" size="sm">
              Start a workout
            </ButtonLink>
          }
        />
      )}

      {/* Big-four e1RM progress */}
      <section className="grid gap-5 lg:grid-cols-2">
        {data.bigFour.map((lift, i) => (
          <ChartCard key={lift.name} title={`${lift.name} — e1RM`} height="h-80">
            {lift.series.length >= 2 ? (
              <E1rmChart series={lift.series} color={BIG_FOUR_COLORS[i]} />
            ) : (
              chartEmpty(
                lift.series.length === 1
                  ? "One session logged — the trend line starts with your second."
                  : `Log ${lift.name} working sets and the estimated 1RM trend appears here.`
              )
            )}
          </ChartCard>
        ))}
      </section>

      {/* Any-exercise explorer */}
      <ChartCard title="Explore any exercise — e1RM" height="h-80">
        <ExerciseE1rmExplorer allSeries={data.allSeries} />
      </ChartCard>

      {/* Weekly volume by muscle group */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Weekly sets by body region" height="h-80" legend={VOLUME_LEGEND}>
          {data.weeklyRegionVolume.some((w) => VOLUME_REGIONS.some((r) => w[r] > 0)) ? (
            <WeeklyMuscleVolumeChart
              data={data.weeklyRegionVolume}
              targetTotal={data.weeklyTargetTotal}
            />
          ) : (
            chartEmpty(
              "Completed sets stack up here by week, against the program's total set target."
            )
          )}
        </ChartCard>

        <SectionCard title="This week vs weekly set targets">
          <div className="space-y-4">
            {data.currentWeekMuscles.map((row) => (
              <ProgressBar
                key={row.muscle}
                pct={(row.sets / row.target) * 100}
                label={row.label}
                valueLabel={`${row.sets} / ${row.target} sets`}
              />
            ))}
          </div>
        </SectionCard>
      </section>

      {/* Frequency + consistency */}
      <section className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Training frequency">
          <FrequencyStrip weeks={data.frequency} />
        </SectionCard>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Consistency"
              value={data.stats.consistencyPct == null ? "—" : `${data.stats.consistencyPct}`}
              unit={data.stats.consistencyPct == null ? undefined : "%"}
              icon={Flame}
            />
            <StatCard
              label="Avg RIR"
              value={data.stats.avgRir == null ? "—" : `${data.stats.avgRir}`}
              icon={Gauge}
            />
            <StatCard
              label="Sessions / wk"
              value={data.stats.sessionsPerWeek == null ? "—" : `${data.stats.sessionsPerWeek}`}
              icon={TrendingUp}
            />
            <StatCard label="Sessions done" value={`${data.stats.completedSessions}`} icon={Flame} />
          </div>
          <ChartCard title="Average RIR trend" height="h-40">
            {data.rirTrend.length >= 2 ? (
              <AvgRirChart data={data.rirTrend} />
            ) : (
              chartEmpty("Log RIR on your sets — the weekly average shows fatigue creep.")
            )}
          </ChartCard>
        </div>
      </section>

      {/* Recovery vs performance + body weight */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Recovery vs performance"
          height="h-80"
          legend={[
            { label: "Weekly volume (lb)", colorVar: "--color-chart-1" },
            { label: "Recovery score", colorVar: "--color-chart-6" },
          ]}
        >
          {data.recoveryPerformance.some((w) => w.volume > 0 || w.recovery != null) ? (
            <RecoveryPerformanceChart data={data.recoveryPerformance} />
          ) : (
            <EmptyState
              chart
              icon={HeartPulse}
              title="Nothing to overlay yet."
              body="Log daily recovery and complete sessions to see how readiness tracks your training load."
            />
          )}
        </ChartCard>

        <ChartCard
          title="Body weight"
          height="h-80"
          legend={[{ label: "7-day average", colorVar: "--color-chart-2" }]}
        >
          {data.bodyWeight.length >= 2 ? (
            <BodyWeightChart data={data.bodyWeight} />
          ) : (
            <EmptyState
              chart
              icon={Scale}
              title="No body-weight readings in range."
              body="Weigh in on the Measurements page — raw dots plus a 7-day average land here."
            />
          )}
        </ChartCard>
      </section>

      {/* Recovery & strain (WHOOP) — only when synced data exists in range */}
      {data.whoop.hasData && (
        <section className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Recovery & HRV (WHOOP)"
            height="h-80"
            legend={[
              { label: "Recovery score", colorVar: "--color-chart-6" },
              { label: "HRV (ms)", colorVar: "--color-chart-5" },
            ]}
          >
            {data.whoop.recoveryTrend.length >= 2 || data.whoop.hrvTrend.length >= 2 ? (
              <WhoopRecoveryChart recovery={data.whoop.recoveryTrend} hrv={data.whoop.hrvTrend} />
            ) : (
              chartEmpty("A couple of synced WHOOP mornings and the recovery trend starts here.")
            )}
          </ChartCard>

          <ChartCard
            title="Sleep (WHOOP)"
            height="h-80"
            legend={[
              { label: "Hours asleep", colorVar: "--color-chart-5" },
              { label: "Performance %", colorVar: "--color-chart-2" },
            ]}
          >
            {data.whoop.sleepTrend.length >= 2 ? (
              <WhoopSleepChart data={data.whoop.sleepTrend} />
            ) : (
              chartEmpty("Nightly sleep duration and performance land here after a couple of syncs.")
            )}
          </ChartCard>

          <ChartCard
            title="Daily strain (WHOOP)"
            height="h-80"
            legend={[{ label: "Day strain (0–21)", colorVar: "--color-chart-4" }]}
          >
            {data.whoop.strainTrend.length >= 2 ? (
              <WhoopStrainChart data={data.whoop.strainTrend} />
            ) : (
              chartEmpty("WHOOP day strain plots here once a couple of cycles are scored.")
            )}
          </ChartCard>
        </section>
      )}
    </div>
  );
}
