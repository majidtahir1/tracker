import Link from "next/link";
import { ChevronRight, History, Trophy } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge, DeloadBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import WhoopWorkoutCard from "@/components/history/WhoopWorkoutCard";
import {
  getHistory,
  type HistorySessionRow,
  type HistoryWhoopRow,
} from "@/lib/queries/workout";

export const metadata = { title: "History" };
export const dynamic = "force-dynamic";

function fmtVolume(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} lb`;
}

/** Interleave logged sessions and WHOOP activities, newest first. */
type WeekEntry =
  | { kind: "session"; date: string; session: HistorySessionRow }
  | { kind: "whoop"; date: string; whoop: HistoryWhoopRow };

function weekEntries(
  sessions: HistorySessionRow[],
  whoopWorkouts: HistoryWhoopRow[]
): WeekEntry[] {
  return [
    ...sessions.map((s): WeekEntry => ({ kind: "session", date: s.date, session: s })),
    ...whoopWorkouts.map((w): WeekEntry => ({ kind: "whoop", date: w.date, whoop: w })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export default async function HistoryPage() {
  const weeks = await getHistory();

  return (
    <div className="space-y-8">
      <PageHeader title="History" subtitle="Every session, newest first, grouped by week." />

      {weeks.length === 0 ? (
        <EmptyState
          icon={History}
          title="No sessions logged yet."
          body="First session's the baseline. Start the next scheduled workout and it lands here with volume and PRs."
          cta={
            <ButtonLink href="/workout" size="sm">
              Start a workout
            </ButtonLink>
          }
        />
      ) : (
        weeks.map((week) => (
          <section key={week.weekStart}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-text">{week.label}</h2>
              {week.weekInCycle > 0 && (
                <span className="text-xs tabular-nums text-text-3">Cycle week {week.weekInCycle}</span>
              )}
            </div>
            <Card>
              <ul className="divide-y divide-border-faint">
                {weekEntries(week.sessions, week.whoopWorkouts).map((entry) => {
                  if (entry.kind === "whoop") {
                    return (
                      <li key={`whoop-${entry.whoop.id}`}>
                        <WhoopWorkoutCard workout={entry.whoop} />
                      </li>
                    );
                  }
                  const s = entry.session;
                  return (
                  <li key={s.id}>
                    <Link
                      href={`/workout/${s.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">{s.name}</span>
                          {s.isDeload && <DeloadBadge />}
                          {s.status === "IN_PROGRESS" && <Badge variant="info">IN PROGRESS</Badge>}
                          {s.status === "SKIPPED" && <Badge variant="danger">SKIPPED</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs tabular-nums text-text-3">
                          {s.dateLabel} · {s.completedSets}/{s.targetSets} sets
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {s.prCount > 0 && (
                          <Badge variant="accent">
                            <Trophy className="size-3" strokeWidth={2} />
                            {s.prCount} PR{s.prCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {s.totalVolume > 0 && (
                          <Badge variant="neutral">{fmtVolume(s.totalVolume)}</Badge>
                        )}
                        <ChevronRight className="size-4 text-text-3" strokeWidth={2} />
                      </div>
                    </Link>
                  </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
