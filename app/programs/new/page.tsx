import PageHeader from "@/components/ui/PageHeader";
import ProgramBuilder from "@/components/programs/ProgramBuilder";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "AI Program Builder" };
export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  await requireUserId();
  const aiConfigured = Boolean(process.env.MINIMAX_API_KEY);
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Program Builder"
        subtitle="Answer a few questions, get a draft program, then refine it in chat until it fits."
      />
      <ProgramBuilder aiConfigured={aiConfigured} />
    </div>
  );
}
