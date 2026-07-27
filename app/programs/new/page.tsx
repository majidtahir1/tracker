import PageHeader from "@/components/ui/PageHeader";
import ProgramBuilder from "@/components/programs/ProgramBuilder";
import { requireUserId } from "@/lib/session";
import { hasAiDataConsent } from "@/lib/ai/consent";

export const metadata = { title: "AI Program Builder" };
export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const userId = await requireUserId();
  const aiConfigured = Boolean(process.env.MINIMAX_API_KEY);
  const consentGranted = await hasAiDataConsent(userId);
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Program Builder"
        subtitle="Answer a few questions and Mo, your AI strength coach, drafts a program — then refine it in chat until it fits."
      />
      <ProgramBuilder aiConfigured={aiConfigured} consentGranted={consentGranted} />
    </div>
  );
}
