import { Sparkles } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ProgramPhaseView from "@/components/programs/ProgramPhaseView";
import CreateFromScratch from "@/components/programs/CreateFromScratch";
import { getPrograms, programPhaseViewData } from "@/lib/queries/programs";
import { activateProgram, addWorkout } from "@/lib/actions/programs";

export const metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const { programs, activeProgramId } = await getPrograms();
  return <div className="space-y-10">
    <PageHeader title="Programs" subtitle="Choose a program and manage its ordered training days." />
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
          <div>
            <h2 className="text-sm font-semibold text-text">Build a new program with the AI coach</h2>
            <p className="mt-1 max-w-prose text-sm text-text-3">
              Answer a few questions — goal, days per week, equipment, priority muscles — and get a
              complete program you can refine in chat.
            </p>
          </div>
        </div>
        <ButtonLink href="/programs/new">
          <Sparkles className="size-4" strokeWidth={2} /> Open AI Program Builder
        </ButtonLink>
      </Card>
      <CreateFromScratch />
    </div>
    {programs.map(program => <section key={program.id} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">{program.name}</h2>
          {program.description && <p className="mt-1 text-sm text-text-3">{program.description}</p>}
        </div>
        {program.id === activeProgramId
          ? <span className="text-xs font-semibold uppercase tracking-wider text-accent">Active program</span>
          : <form action={activateProgram}><input type="hidden" name="programId" value={program.id}/><Button variant="subtle">Use program</Button></form>}
      </div>
      {program.workouts.length > 0 ? (
        <ProgramPhaseView data={programPhaseViewData(program)} />
      ) : (
        <p className="text-sm text-text-3">No training days yet — add the first one below.</p>
      )}
      <Card className="p-4"><form action={addWorkout} className="flex gap-2"><input type="hidden" name="programId" value={program.id}/><Input name="name" placeholder={`Day ${program.workouts.length + 1} workout name`} required/><Button>Add workout</Button></form></Card>
    </section>)}
  </div>;
}
