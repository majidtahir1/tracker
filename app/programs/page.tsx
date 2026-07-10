import { Sparkles } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getPrograms } from "@/lib/queries/programs";
import { activateProgram, addWorkout, createProgram } from "@/lib/actions/programs";

export const metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const { programs, activeProgramId } = await getPrograms();
  return <div className="space-y-8">
    <PageHeader title="Programs" subtitle="Choose a program and manage its ordered training days."
      actions={<ButtonLink href="/programs/new"><Sparkles className="size-4" strokeWidth={2} /> AI Program Builder</ButtonLink>} />
    <Card className="p-5"><form action={createProgram} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Input name="name" placeholder="Program name" required />
      <Input name="description" placeholder="Description (optional)" />
      <Button>Create program</Button>
    </form></Card>
    {programs.map(program => <section key={program.id} className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold text-text">{program.name}</h2><p className="text-sm text-text-3">{program.description}</p></div>
      {program.id === activeProgramId ? <span className="text-xs font-semibold uppercase tracking-wider text-accent">Active program</span> : <form action={activateProgram}><input type="hidden" name="programId" value={program.id}/><Button variant="subtle">Use program</Button></form>}</div>
      <div className="grid gap-4 xl:grid-cols-2">{program.workouts.map(workout => <Card key={workout.id} className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-accent">Day {workout.dayNumber}</p><h3 className="mt-1 text-lg font-semibold text-text">{workout.name}</h3></div><ButtonLink href={`/programs/${workout.id}`} variant="subtle" size="sm">Edit</ButtonLink></div>
        <div className="space-y-2">{workout.exercises.map(slot => <div key={slot.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-text">{slot.exercise.name}</span><span className="shrink-0 tabular-nums text-text-3">{slot.baseSets} × {slot.repRangeMin}–{slot.repRangeMax}</span></div>)}</div>
      </Card>)}</div>
      <Card className="p-4"><form action={addWorkout} className="flex gap-2"><input type="hidden" name="programId" value={program.id}/><Input name="name" placeholder={`Day ${program.workouts.length + 1} workout name`} required/><Button>Add workout</Button></form></Card>
    </section>)}
  </div>;
}
