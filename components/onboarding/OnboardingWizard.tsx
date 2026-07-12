"use client";

/**
 * components/onboarding/OnboardingWizard.tsx — first-run setup after signup
 * (docs/superpowers/specs/2026-07-11-onboarding-wizard-design.md).
 * Three skippable steps: program choice, starting body weight, wearable
 * (WHOOP or Fitbit).
 * Renders full-screen above the app chrome; completing or skipping stamps
 * onboardedAt via completeOnboarding.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Check, Dumbbell, Scale, Sparkles, Wrench } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { completeOnboarding } from "@/lib/actions/onboarding";

export interface StarterProgram {
  name: string;
  daysPerWeek: number;
  exercisesMin: number;
  exercisesMax: number;
  estMinutesMin: number;
  estMinutesMax: number;
}

type ProgramChoice = "starter" | "ai" | "manual";

const DESTINATIONS: Record<ProgramChoice, string> = {
  starter: "/",
  ai: "/programs/new",
  manual: "/programs",
};

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

export default function OnboardingWizard({ starter }: { starter: StarterProgram | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<ProgramChoice>(starter ? "starter" : "ai");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsedWeight = weight.trim() === "" ? null : Number(weight);

  function finish(opts: { connectWearable?: "whoop" | "fitbit"; skipAll?: boolean } = {}) {
    setError(null);
    const bodyWeightLb = opts.skipAll ? null : parsedWeight;
    if (bodyWeightLb != null && (!Number.isFinite(bodyWeightLb) || bodyWeightLb < 30 || bodyWeightLb > 1000)) {
      setError("Body weight should be between 30 and 1000 lb.");
      return;
    }
    startTransition(async () => {
      // Skipping setup activates nothing — the dashboard shows "pick a program".
      const res = await completeOnboarding({
        bodyWeightLb,
        programChoice: opts.skipAll ? "skip" : choice,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save — try again.");
        return;
      }
      if (opts.connectWearable) {
        // Full navigation: the OAuth flow leaves the app and returns signed-in.
        window.location.href = `/api/${opts.connectWearable}/auth`;
        return;
      }
      router.push(DESTINATIONS[choice]);
      router.refresh();
    });
  }

  const stepBody = [
    // Step 1 — program choice
    <div key="program" className="space-y-3">
      <h2 className="font-display text-xl font-semibold tracking-tight text-text">
        How do you want to train?
      </h2>
      <p className="text-sm text-text-3">
        You can always change programs later — nothing here is permanent.
      </p>
      {starter && (
        <ChoiceCard
          active={choice === "starter"}
          onClick={() => setChoice("starter")}
          icon={<Dumbbell className="size-4" strokeWidth={2} />}
          title={`Start with ${starter.name}`}
          badge="Recommended"
          body={`A ready-made plan: ${starter.daysPerWeek} days/week, ${range(starter.exercisesMin, starter.exercisesMax)} exercises per session, ~${range(starter.estMinutesMin, starter.estMinutesMax)} minutes. Weights progress automatically as you log.`}
        />
      )}
      <ChoiceCard
        active={choice === "ai"}
        onClick={() => setChoice("ai")}
        icon={<Sparkles className="size-4" strokeWidth={2} />}
        title="Build it with the AI coach"
        body="Answer a few questions — goal, days, equipment, priority muscles — and get a personalized program you can refine in chat."
      />
      <ChoiceCard
        active={choice === "manual"}
        onClick={() => setChoice("manual")}
        icon={<Wrench className="size-4" strokeWidth={2} />}
        title="Build it myself"
        body="Head to the Programs page and put together your own days and exercises."
      />
    </div>,

    // Step 2 — body weight
    <div key="weight" className="space-y-3">
      <h2 className="font-display text-xl font-semibold tracking-tight text-text">
        Starting body weight
      </h2>
      <p className="text-sm text-text-3">
        One number to anchor your progress charts. Logged as today&rsquo;s measurement — you can
        track it (and more) under Measurements.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={30}
          max={1000}
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 185"
          aria-label="Body weight in pounds"
          className="max-w-[10rem]"
        />
        <span className="text-sm text-text-3">lb</span>
      </div>
    </div>,

    // Step 3 — wearable (WHOOP or Fitbit)
    <div key="wearable" className="space-y-3">
      <h2 className="font-display text-xl font-semibold tracking-tight text-text">
        Do you wear a WHOOP or Fitbit?
      </h2>
      <p className="text-sm leading-relaxed text-text-3">
        Connect one and the coach reads your recovery each morning — on rough days it suggests
        backing off instead of pushing, and your briefs reference real sleep and strain. No
        wearable? Skip this and the app simply coaches from your training data.
      </p>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
        <Activity className="size-4 shrink-0 text-accent" strokeWidth={2} />
        Recovery-aware weight recommendations, morning readiness briefs, strain-matched session
        notes.
      </div>
    </div>,
  ];

  const last = step === stepBody.length - 1;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Dumbbell className="size-5 text-accent" strokeWidth={2} />
            <span className="text-sm font-semibold tracking-tight text-text">Welcome</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${stepBody.length}`}>
            {stepBody.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">{stepBody[step]}</div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="space-y-3 pb-4">
          {last ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                disabled={pending}
                onClick={() => finish({ connectWearable: "whoop" })}
                className="flex-1"
              >
                <Activity className="size-4" strokeWidth={2} />
                Connect WHOOP
              </Button>
              <Button
                size="lg"
                disabled={pending}
                onClick={() => finish({ connectWearable: "fitbit" })}
                className="flex-1"
              >
                <Activity className="size-4" strokeWidth={2} />
                Connect Fitbit
              </Button>
              <Button
                size="lg"
                variant="subtle"
                disabled={pending}
                onClick={() => finish()}
                className="flex-1"
              >
                <Check className="size-4" strokeWidth={2} />
                {pending ? "Finishing…" : "Neither — finish"}
              </Button>
            </div>
          ) : (
            <Button size="lg" disabled={pending} onClick={() => setStep(step + 1)} className="w-full">
              Continue
              <ArrowRight className="size-4" strokeWidth={2} />
            </Button>
          )}
          <div className="flex items-center justify-between text-xs">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="text-text-3 transition-colors hover:text-text"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            {!last && (
              <button
                type="button"
                disabled={pending}
                onClick={() => finish({ skipAll: true })}
                className="text-text-3 transition-colors hover:text-text"
              >
                Skip setup for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  body,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-md border p-4 text-left transition-colors ${
        active
          ? "border-accent/60 bg-accent-muted"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={active ? "text-accent" : "text-text-3"}>{icon}</span>
        <span className="text-sm font-semibold text-text">{title}</span>
        {badge && (
          <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-3">{body}</p>
    </button>
  );
}
