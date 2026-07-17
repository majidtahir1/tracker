"use client";

import { useState, useTransition } from "react";
import { updateAiDataConsent } from "@/lib/actions/settings";

export default function AiDataConsentCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      await updateAiDataConsent(next);
    });
  }

  return (
    <div className="flex items-start justify-between gap-5">
      <div>
        <p className="text-sm font-medium text-text">AI coaching</p>
        <p className="mt-1 text-xs leading-5 text-text-3">
          Allow Progression to send workout details and, when connected, WHOOP or Google Health
          recovery and sleep metrics to our AI service to generate personalized coaching. The AI
          service does not receive your username, progress photos, or wearable access tokens. When
          off, coaching uses calculations performed by Progression without sharing data.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Allow AI data processing"
        disabled={pending}
        onClick={() => change(!enabled)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          enabled ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
