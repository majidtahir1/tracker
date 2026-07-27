"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { updateAiDataConsent } from "@/lib/actions/settings";
import { AI_CONSENT_COPY as COPY } from "@/lib/ai/consent-copy";

/** Just-in-time AI consent: disclose what is sent and to whom, then ask. */
export default function AiConsentPrompt({ onDecided }: { onDecided: (enabled: boolean) => void }) {
  const [pending, startTransition] = useTransition();

  function decide(enabled: boolean) {
    startTransition(async () => {
      await updateAiDataConsent(enabled);
      onDecided(enabled);
    });
  }

  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text">
        <Sparkles className="size-4" strokeWidth={2} />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-text">{COPY.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-2">{COPY.intro}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-2">
          {COPY.sends.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-2 text-xs leading-5 text-text-3">{COPY.recipient}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(true)}
            className="inline-flex h-9 items-center justify-center rounded-sm bg-accent px-4 text-xs font-semibold text-accent-text transition-colors hover:bg-accent/90 disabled:opacity-40"
          >
            {COPY.allow}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(false)}
            className="inline-flex h-9 items-center justify-center rounded-sm border border-border px-4 text-xs font-semibold text-text-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            {COPY.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
