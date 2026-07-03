import { Trophy, CheckCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/Card";
import { Badge, PRBadge } from "@/components/ui/Badge";
import Button, { ButtonLink } from "@/components/ui/Button";
import { getRecordsData, type PrCell } from "@/lib/queries/records";
import { markAllPrsSeen } from "@/lib/actions/records";
import { fmtDisplay } from "@/lib/dates";
import type { PrType } from "@/lib/generated/prisma/enums";

export const metadata = { title: "Records" };
export const dynamic = "force-dynamic";

const PR_COLUMNS: { type: PrType; label: string }[] = [
  { type: "HEAVIEST_WEIGHT", label: "Heaviest" },
  { type: "BEST_E1RM", label: "Best e1RM" },
  { type: "MOST_REPS", label: "Most reps" },
  { type: "MOST_SESSION_VOLUME", label: "Session volume" },
];

const TIMELINE_LABELS: Record<PrType, string> = {
  HEAVIEST_WEIGHT: "WEIGHT",
  BEST_E1RM: "e1RM",
  MOST_REPS: "REPS",
  MOST_SESSION_VOLUME: "VOLUME",
};

function fmtWeight(lb: number): string {
  return lb % 1 === 0 ? `${lb}` : `${lb.toFixed(1)}`.replace(/\.0$/, "");
}

function fmtCell(type: PrType, cell: PrCell): string {
  switch (type) {
    case "HEAVIEST_WEIGHT":
      return `${fmtWeight(cell.value)} lb${cell.reps != null ? ` ×${cell.reps}` : ""}`;
    case "BEST_E1RM":
      return `${Math.round(cell.value)} lb`;
    case "MOST_REPS":
      return `${cell.value} reps${cell.weight != null ? ` @ ${fmtWeight(cell.weight)} lb` : ""}`;
    case "MOST_SESSION_VOLUME":
      return `${Math.round(cell.value).toLocaleString("en-US")} lb`;
  }
}

export default async function RecordsPage() {
  const data = await getRecordsData();

  if (data.totalPrs === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Records" subtitle="Personal records by exercise." />
        <EmptyState
          icon={Trophy}
          title="No PRs yet."
          body="Every heaviest weight, best e1RM, rep record, and session volume lands here. First session's the baseline — go set some."
          cta={
            <ButtonLink href="/workout" size="sm">
              Start a workout
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Records"
        subtitle={`${data.totalPrs} personal records across ${data.exercises.length} exercises.`}
        actions={
          data.unseenCount > 0 ? (
            <form action={markAllPrsSeen}>
              <Button type="submit" variant="ghost" size="sm">
                <CheckCheck className="size-4" strokeWidth={2} />
                Mark {data.unseenCount} new as seen
              </Button>
            </form>
          ) : undefined
        }
      />

      {data.unseenCount > 0 && (
        <div className="flex items-center gap-3 rounded-sm border border-accent-border bg-accent-muted px-4 py-3 text-sm text-text">
          <Trophy className="size-4 shrink-0 text-accent" strokeWidth={2} />
          <span>
            <span className="font-semibold text-accent">
              {data.unseenCount} new PR{data.unseenCount === 1 ? "" : "s"}
            </span>{" "}
            since your last visit.
          </span>
        </div>
      )}

      {/* PR board per exercise */}
      <SectionCard title="PR board" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-3">
                  Exercise
                </th>
                {PR_COLUMNS.map((col) => (
                  <th
                    key={col.type}
                    className="border-b border-border px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-3"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.exercises.map((ex) => (
                <tr
                  key={ex.exerciseId}
                  className="border-b border-border-faint last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <td className="px-5 py-3.5 text-text-2">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-text">{ex.exerciseName}</span>
                      {ex.hasUnseen && <Badge variant="accent">NEW</Badge>}
                    </span>
                  </td>
                  {PR_COLUMNS.map((col) => {
                    const cell = ex.records[col.type];
                    return (
                      <td key={col.type} className="px-5 py-3.5 text-right tabular-nums">
                        {cell ? (
                          <span className={cell.unseen ? "font-semibold text-accent" : "text-text"}>
                            {fmtCell(col.type, cell)}
                          </span>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Recent PR timeline */}
      <SectionCard title="Recent PRs" flush>
        <ul>
          {data.timeline.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 border-b border-border-faint px-5 py-4 last:border-0 hover:bg-surface-2 transition-colors"
            >
              {entry.unseen && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
              <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-accent-muted text-accent">
                <Trophy className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{entry.exerciseName}</p>
                <p className="mt-0.5 text-xs tabular-nums text-text-3">
                  {fmtCell(entry.type, {
                    value: entry.value,
                    weight: entry.weight,
                    reps: entry.reps,
                    date: entry.date,
                    unseen: entry.unseen,
                  })}
                  {" · "}
                  {fmtDisplay(entry.date)}
                </p>
              </div>
              {entry.unseen ? (
                <PRBadge type={TIMELINE_LABELS[entry.type]} />
              ) : (
                <Badge variant="neutral">{TIMELINE_LABELS[entry.type]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
