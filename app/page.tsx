import {
  BarChart3,
  BatteryLow,
  Dumbbell,
  Flame,
  HeartPulse,
  Percent,
  Scale,
  Trophy,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ChartCard from "@/components/ui/ChartCard";
import { Badge } from "@/components/ui/Badge";
import NextWorkoutCard from "@/components/dashboard/NextWorkoutCard";
import LastWorkoutCard from "@/components/dashboard/LastWorkoutCard";
import NotificationsCard from "@/components/dashboard/NotificationsCard";
import { NOTIFICATIONS_ENABLED } from "@/lib/notifications";
import CoachBriefCard from "@/components/dashboard/CoachBriefCard";
import {
  BodyWeightChart,
  ConsistencyChart,
  E1rmChart,
  FrequencyChart,
  MuscleVolumeChart,
  WeeklyVolumeChart,
} from "@/components/dashboard/DashboardCharts";
import { getDashboardData } from "@/lib/queries/dashboard";
import { maybeAutoSync } from "@/lib/queries/whoop";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await maybeAutoSync().catch(() => {});
  const data = await getDashboardData();
  const { position, stats } = data;

  const blockChip = position
    ? position.isDeload
      ? `Block ${position.cycleNumber} · Week ${position.week} · Deload`
      : `Block ${position.cycleNumber} · Week ${position.week} · Deload in ${Math.ceil(
          position.deloadInDays / 7
        )} wks`
    : null;

  const recoveryClass =
    stats.recoveryScore == null
      ? "text-text"
      : stats.recoveryScore >= 70
        ? "text-success"
        : stats.recoveryScore >= 40
          ? "text-warning"
          : "text-danger";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Block overview, next workout, and trends."
        actions={blockChip ? <Badge className="px-3 py-1.5 text-xs">{blockChip}</Badge> : undefined}
      />

      <CoachBriefCard />

      <NextWorkoutCard next={data.nextWorkout} isNewUser={!data.lastWorkout} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 lg:gap-5">
        <StatCard
          label="Body Weight"
          value={stats.bodyWeight?.value ?? "—"}
          unit={stats.bodyWeight ? "lb" : undefined}
          icon={Scale}
          trend={stats.bodyWeight?.trend ?? undefined}
        />
        <StatCard
          label="Weekly Avg"
          value={stats.weeklyAvgWeight ?? "—"}
          unit={stats.weeklyAvgWeight ? "lb" : undefined}
          icon={Scale}
        />
        <StatCard
          label="Est Body Fat"
          value={stats.bodyFat ?? "—"}
          unit={stats.bodyFat ? "%" : undefined}
          icon={Percent}
        />
        <StatCard
          label="Nutrition Today"
          value={stats.caloriesToday != null ? stats.caloriesToday.toLocaleString("en-US") : "—"}
          unit={stats.caloriesToday != null ? "kcal" : undefined}
          icon={Flame}
          trend={{
            direction: "neutral",
            label:
              stats.proteinToday != null
                ? `${stats.proteinToday} / ${stats.proteinTargetG} g protein`
                : `0 / ${stats.proteinTargetG} g protein`,
          }}
        />
        <StatCard label="Total Workouts" value={String(stats.totalWorkouts)} icon={Dumbbell} />
        <StatCard
          label="Week Streak"
          value={String(stats.streakWeeks)}
          unit={stats.streakWeeks === 1 ? "wk" : "wks"}
          icon={Flame}
        />
        <StatCard
          label="Volume This Week"
          value={stats.volumeThisWeek.value.toLocaleString("en-US")}
          unit="lb"
          icon={BarChart3}
          trend={stats.volumeThisWeek.trend ?? undefined}
        />
        <StatCard
          label={stats.recoverySource === "whoop" ? "Recovery · WHOOP" : "Recovery"}
          value={stats.recoveryScore != null ? String(stats.recoveryScore) : "—"}
          unit={stats.recoveryScore != null ? "/ 100" : undefined}
          icon={HeartPulse}
          valueClassName={recoveryClass}
        />
        <StatCard label="PRs This Block" value={String(stats.prCountBlock)} icon={Trophy} />
        <StatCard
          label="Deload"
          value={stats.isDeload ? "NOW" : String(stats.deloadInDays)}
          unit={stats.isDeload ? undefined : "days"}
          icon={BatteryLow}
          valueClassName={stats.isDeload ? "text-info" : "text-text"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Body Weight"
          legend={[{ label: "Weight (lb)", colorVar: "--color-chart-2" }]}
        >
          <BodyWeightChart data={data.charts.bodyWeight} />
        </ChartCard>
        <ChartCard
          title="Estimated 1RM — Big 4"
          legend={[
            { label: "Bench", colorVar: "--color-chart-1" },
            { label: "Squat", colorVar: "--color-chart-3" },
            { label: "RDL", colorVar: "--color-chart-4" },
            { label: "OHP", colorVar: "--color-chart-5" },
          ]}
        >
          <E1rmChart data={data.charts.e1rm} />
        </ChartCard>
        <ChartCard
          title="Weekly Volume"
          legend={[{ label: "Total load (lb)", colorVar: "--color-chart-1" }]}
        >
          <WeeklyVolumeChart data={data.charts.weeklyVolume} />
        </ChartCard>
        <ChartCard
          title="Muscle-Group Sets vs Target"
          legend={[{ label: "Actual", colorVar: "--color-chart-1" }]}
        >
          <MuscleVolumeChart data={data.charts.muscleVolume} />
        </ChartCard>
        <ChartCard
          title="Workout Frequency"
          legend={[{ label: "Sessions / week", colorVar: "--color-chart-6" }]}
        >
          <FrequencyChart data={data.charts.frequency} />
        </ChartCard>
        <ChartCard
          title="Consistency"
          legend={[{ label: "% of scheduled sessions", colorVar: "--color-chart-1" }]}
        >
          <ConsistencyChart data={data.charts.consistency} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <LastWorkoutCard last={data.lastWorkout} />
        {NOTIFICATIONS_ENABLED && (
          <NotificationsCard notifications={data.notifications} unreadCount={data.unreadCount} />
        )}
      </div>
    </div>
  );
}
