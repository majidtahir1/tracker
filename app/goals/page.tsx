import PageHeader from "@/components/ui/PageHeader";
import GoalsManager from "@/components/goals/GoalsManager";
import { getGoalsPageData } from "@/lib/queries/goals";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const { goals, currentValues } = await getGoalsPageData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Goals"
        subtitle="Targets and pace — strength, weight, measurements. Current values pull straight from your logs."
      />
      <GoalsManager goals={goals} currentValues={currentValues} />
    </div>
  );
}
