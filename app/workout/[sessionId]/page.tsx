import { notFound } from "next/navigation";
import { XCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import WorkoutLogger from "@/components/workout/WorkoutLogger";
import SessionSummary from "@/components/workout/SessionSummary";
import { getSessionDetail } from "@/lib/queries/workout";
import { fmtDisplay } from "@/lib/dates";

export const metadata = { title: "Log Workout" };
export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { sessionId } = await params;
  const { edit } = await searchParams;
  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();

  const { session, summary } = detail;

  if (session.status === "COMPLETED") {
    if (edit === "1") return <WorkoutLogger session={session} editMode />;
    return <SessionSummary session={session} summary={summary} />;
  }

  if (session.status === "SKIPPED") {
    return (
      <div className="space-y-8">
        <PageHeader title={session.name} subtitle={`${fmtDisplay(session.date)} · skipped`} />
        <EmptyState
          icon={XCircle}
          title="This session was skipped."
          body="No sets were logged. Get the next one — consistency beats perfection."
          cta={
            <ButtonLink href="/workout" size="sm">
              Next workout
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return <WorkoutLogger session={session} />;
}
