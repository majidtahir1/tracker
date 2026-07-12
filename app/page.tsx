import { BarChart3, Flame, HeartPulse, Scale, Trophy } from "lucide-react";
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
  MuscleVolumeChart,
  WeeklyVolumeChart,
} from "@/components/dashboard/DashboardCharts";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { shouldOnboard } from "@/lib/onboarding";
import { getDashboardData } from "@/lib/queries/dashboard";
import { maybeAutoSync } from "@/lib/queries/whoop";
import { maybeAutoSyncFitbit } from "@/lib/queries/fitbit";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // First-run wizard: only for accounts that never finished it and never trained.
  const userId = await requireUserId();
  const [settings, completedCount] = await Promise.all([
    prisma.appSettings.findUnique({ where: { userId }, select: { onboardedAt: true } }),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  if (shouldOnboard(settings, completedCount)) redirect("/onboarding");

  await Promise.all([maybeAutoSync().catch(() => {}), maybeAutoSyncFitbit().catch(() => {})]);
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
          label="Tonnage This Week"
          value={stats.volumeThisWeek.value.toLocaleString("en-US")}
          unit="lb"
          icon={BarChart3}
          trend={
            stats.volumeThisWeek.trend ?? { direction: "neutral", label: "weight × reps, all sets" }
          }
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
          label="Week Streak"
          value={String(stats.streakWeeks)}
          unit={stats.streakWeeks === 1 ? "wk" : "wks"}
          icon={Flame}
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
          title="Weekly Tonnage"
          legend={[{ label: "Weight × reps (lb)", colorVar: "--color-chart-1" }]}
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
