"use client";

/**
 * Connect button for wearable integrations. Instead of jumping straight to a
 * third-party login page (jarring: "why is WHOOP asking me for a password?"),
 * it opens a short explainer sheet — whose credentials to use, what access is
 * granted — then continues to /api/{provider}/auth.
 */
import { useState } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import Button, { buttonClasses } from "@/components/ui/Button";

export type WearableProvider = "whoop" | "fitbit";

const COPY: Record<
  WearableProvider,
  { name: string; signInWith: string; steps: string[]; note: string }
> = {
  whoop: {
    name: "WHOOP",
    signInWith:
      "Next you'll see WHOOP's own sign-in page. Use your WHOOP account — the same email and password as the WHOOP app — not your Progression login.",
    steps: [
      "Sign in on WHOOP's page",
      "Approve read-only access to recovery, sleep, and strain",
      "You'll land right back here, connected",
    ],
    note: "Progression never sees your WHOOP password. Disconnect anytime.",
  },
  fitbit: {
    name: "Fitbit",
    signInWith:
      "Next you'll be sent to Google (Fitbit accounts are Google accounts — this may open in your browser). Pick the Google account your Fitbit app uses — not your Progression login.",
    steps: [
      "Choose your Google account",
      "Approve read-only access to activity, sleep, and heart data — if Google shows an “unverified app” notice, choose Continue",
      "Return to the app when it says you're connected",
    ],
    note: "Progression never sees your Google password. Disconnect anytime.",
  },
};

export default function ConnectWearableButton({
  provider,
  variant = "primary",
  size = "md",
  className,
  onContinue,
  children,
}: {
  provider: WearableProvider;
  variant?: Parameters<typeof buttonClasses>[0];
  size?: Parameters<typeof buttonClasses>[1];
  className?: string;
  /** Override the default navigation (e.g. save onboarding state first). */
  onContinue?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const copy = COPY[provider];

  const proceed = () => {
    if (onContinue) onContinue();
    else window.location.href = `/api/${provider}/auth`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? buttonClasses(variant, size)}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={`Connect ${copy.name}`}
            className="w-full max-w-md rounded-t-lg border border-border bg-surface p-5 shadow-[var(--shadow-raise)] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Connect {copy.name}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <p className="mt-2 text-sm text-text-2">{copy.signInWith}</p>

            <ol className="mt-4 space-y-2">
              {copy.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold tabular-nums text-text-3">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="mt-4 inline-flex items-start gap-2 text-xs text-text-3">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              {copy.note}
            </p>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="subtle" size="md" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="button" size="md" onClick={proceed} className="flex-1">
                Continue to {provider === "fitbit" ? "Google" : copy.name}
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
