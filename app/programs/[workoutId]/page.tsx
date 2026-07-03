import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { getProgramWorkout } from "@/lib/queries/programs";
import { addProgramExercise, updateWorkoutDetails } from "@/lib/actions/programs";
import SetCountControl from "@/components/programs/SetCountControl";

export const metadata = { title: "Edit Workout" };
export const dynamic = "force-dynamic";

export default async function EditWorkoutPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  const { workout, exercises } = await getProgramWorkout(workoutId);
  if (!workout) notFound();
  return <div className="space-y-6">
    <Link href="/programs" className="text-sm text-text-3 hover:text-text">← Programs</Link>
    <PageHeader title={`Edit Day ${workout.dayNumber}`} subtitle={workout.program?.name ?? "Program workout"}/>
    <Card className="p-5"><form action={updateWorkoutDetails} className="space-y-6">
      <input type="hidden" name="workoutId" value={workout.id}/>
      <div><label className="mb-2 block text-sm text-text-3">Workout name</label><Input name="name" defaultValue={workout.name} required/></div>
      <div className="space-y-4">{workout.exercises.map((slot, index) => <div key={slot.id} className="space-y-4 rounded-sm border border-border-faint bg-bg-subtle p-4">
        <input type="hidden" name="slotId" value={slot.id}/>
        <div><label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-3">Exercise {index + 1}</label><Select name={`exercise-${index}`} defaultValue={slot.exerciseId}>{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</Select></div>
        <SetCountControl name={`sets-${index}`} initial={slot.baseSets}/>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-3">Minimum reps per set</label><Input name={`repMin-${index}`} numeric defaultValue={slot.repRangeMin}/></div><div><label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-3">Maximum reps per set</label><Input name={`repMax-${index}`} numeric defaultValue={slot.repRangeMax}/></div></div>
      </div>)}</div>
      <div className="flex justify-end"><Button size="lg">Save workout</Button></div>
    </form></Card>
    <Card className="p-5"><form action={addProgramExercise} className="flex flex-col gap-3 sm:flex-row"><input type="hidden" name="workoutId" value={workout.id}/><Select name="exerciseId" aria-label="Exercise to add">{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</Select><Button className="shrink-0">+ Add exercise</Button></form></Card>
  </div>;
}
