/**
 * Last Workout summary (DESIGN.md §4.1 item 5): name, date, volume, PR badges
 * and a per-exercise mini-table. Server component.
 */
import { Dumbbell } from "lucide-react";
import { SectionCard, CardAction } from "@/components/ui/Card";
import { DeloadBadge, PRBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import Link from "next/link";
import type { LastWorkoutInfo } from "@/lib/queries/dashboard";

export default function LastWorkoutCard({ last }: { last: LastWorkoutInfo | null }) {
  if (!last) {
    return (
      <SectionCard title="Last Workout">
        <EmptyState
          icon={Dumbbell}
          title="No sets logged yet."
          body="First session's the baseline. Start Monday's Push workout and it lands here."
          cta={
            <ButtonLink href="/workout" size="sm">
              Start Workout
            </ButtonLink>
          }
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Last Workout"
      flush
      action={
        <Link href="/history">
          <CardAction>View all →</CardAction>
        </Link>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text">{last.templateName}</p>
          <p className="mt-0.5 text-xs text-text-3">{last.dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {last.isDeload && <DeloadBadge />}
          {last.prLabels.map((label) => (
            <PRBadge key={label} type={label} />
          ))}
          <span className="font-display text-lg font-semibold tabular-nums tracking-tight text-text">
            {last.totalVolume.toLocaleString("en-US")}
            <span className="ml-1 text-xs font-normal text-text-3">lb</span>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border-faint">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                Exercise
              </th>
              <th className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3">
                Top set
              </th>
              <th className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3">
                Sets
              </th>
              <th className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3">
                Volume
              </th>
            </tr>
          </thead>
          <tbody>
            {last.exercises.map((ex) => (
              <tr
                key={ex.name}
                className="border-b border-border-faint last:border-0 hover:bg-surface-2 transition-colors"
              >
                <td className="px-5 py-3.5 text-text-2">{ex.name}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-text font-mono text-xs">
                  {ex.topSet}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-text">{ex.sets}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-text">
                  {ex.volume > 0 ? ex.volume.toLocaleString("en-US") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
