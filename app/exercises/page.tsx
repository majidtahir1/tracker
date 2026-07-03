import PageHeader from "@/components/ui/PageHeader";
import ExerciseLibrary from "@/components/exercises/ExerciseLibrary";
import AddExerciseForm from "@/components/exercises/AddExerciseForm";
import { getExerciseLibrary } from "@/lib/queries/exercises";

export const metadata = { title: "Exercises" };
export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await getExerciseLibrary();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Exercises"
          subtitle="The movement library — search, filter, favorite."
        />
        <AddExerciseForm />
      </div>
      <ExerciseLibrary exercises={exercises} />
    </div>
  );
}
