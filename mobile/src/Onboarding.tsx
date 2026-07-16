import { useState } from "react";
import { Activity, ArrowRight, Bot, Check, Dumbbell, Wrench } from "lucide-react";
import { post } from "./api";
import { ConnectSheet, startWearableAuth, WEARABLE_COPY, type Provider } from "./ConnectWearable";

/**
 * First-run setup wizard — the iOS counterpart of the web
 * components/onboarding/OnboardingWizard.tsx. Three skippable steps: program
 * choice, starting body weight, wearable. Completing or skipping stamps
 * onboardedAt via POST /api/mobile/onboarding; wearable connect fetches the
 * provider authorize URL (the webview's bearer auth can't ride window.open)
 * and finishes in the system browser via the DB-backed OAuth state.
 */

type Json = Record<string, any>;
type ProgramChoice = "starter" | "ai" | "manual";

export interface OnboardingData {
  starter: {
    name: string;
    daysPerWeek: number;
    exercisesMin: number;
    exercisesMax: number;
    estMinutesMin: number;
    estMinutesMax: number;
  } | null;
  whoopConfigured: boolean;
  fitbitConfigured: boolean;
}

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

export default function Onboarding({ data, onDone }: { data: OnboardingData; onDone: (dest: "dashboard" | "ai" | "manual") => void }) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<ProgramChoice>(data.starter ? "starter" : "ai");
  const [weight, setWeight] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<Provider | null>(null);

  async function finish(opts: { connectWearable?: Provider; skipAll?: boolean } = {}) {
    setError("");
    const parsed = weight.trim() === "" ? null : Number(weight);
    const bodyWeightLb = opts.skipAll ? null : parsed;
    if (bodyWeightLb != null && (!Number.isFinite(bodyWeightLb) || bodyWeightLb < 30 || bodyWeightLb > 1000)) {
      setError("Body weight should be between 30 and 1000 lb.");
      return;
    }
    setPending(true);
    try {
      // Skipping setup activates nothing — the dashboard shows "pick a program".
      await post<Json>("/api/mobile/onboarding", {
        action: "complete",
        bodyWeightLb,
        programChoice: opts.skipAll ? "skip" : choice,
      });
      if (opts.connectWearable) {
        await startWearableAuth(opts.connectWearable);
      }
      onDone(opts.skipAll || choice === "starter" ? "dashboard" : choice);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save — try again.");
    } finally {
      setPending(false);
    }
  }

  const wearables: Provider[] = [
    ...(data.whoopConfigured ? (["whoop"] as const) : []),
    ...(data.fitbitConfigured ? (["fitbit"] as const) : []),
  ];

  const steps: React.ReactNode[] = [
    // Step 1 — program choice
    <div className="wizard-step" key="program">
      <h2>How do you want to train?</h2>
      <p>You can always change programs later — nothing here is permanent.</p>
      {data.starter && (
        <ChoiceCard
          active={choice === "starter"}
          onClick={() => setChoice("starter")}
          icon={<Dumbbell size={17} />}
          title={`Start with ${data.starter.name}`}
          badge="Recommended"
          body={`A ready-made plan: ${data.starter.daysPerWeek} days/week, ${range(data.starter.exercisesMin, data.starter.exercisesMax)} exercises per session, ~${range(data.starter.estMinutesMin, data.starter.estMinutesMax)} minutes. Weights progress automatically as you log.`}
        />
      )}
      <ChoiceCard
        active={choice === "ai"}
        onClick={() => setChoice("ai")}
        icon={<Bot size={17} />}
        title="Build it with the AI coach"
        body="Answer a few questions — goal, days, equipment, priority muscles — and get a personalized program you can refine in chat."
      />
      <ChoiceCard
        active={choice === "manual"}
        onClick={() => setChoice("manual")}
        icon={<Wrench size={17} />}
        title="Build it myself"
        body="Put together your own days and exercises from the movement catalog."
      />
    </div>,

    // Step 2 — body weight
    <div className="wizard-step" key="weight">
      <h2>Starting body weight</h2>
      <p>One number to anchor your progress charts. Logged as today's measurement — you can track it (and more) later.</p>
      <div className="wizard-weight">
        <input
          type="number"
          inputMode="decimal"
          min={30}
          max={1000}
          step="0.1"
          value={weight}
          placeholder="e.g. 185"
          aria-label="Body weight in pounds"
          onChange={(e) => setWeight(e.target.value)}
        />
        <span>lb</span>
      </div>
    </div>,

    // Step 3 — wearable
    <div className="wizard-step" key="wearable">
      <h2>Do you wear a WHOOP or Fitbit?</h2>
      <p>
        Connect one and the coach reads your recovery each morning — on rough days it suggests
        backing off instead of pushing. No wearable? Skip this and the app simply coaches from
        your training data.
      </p>
      <div className="wizard-note">
        <Activity size={16} />
        Recovery-aware weight recommendations, morning readiness briefs, strain-matched session notes.
      </div>
    </div>,
  ];

  const last = step === steps.length - 1;

  return (
    <div className="wizard">
      <div className="wizard-head">
        <div className="auth-brand"><Dumbbell size={20} /><strong>Welcome</strong></div>
        <div className="wizard-dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}
        </div>
      </div>

      <div className="wizard-body">{steps[step]}</div>

      {error && <p className="error">{error}</p>}

      <div className="wizard-actions">
        {last ? (
          <>
            {wearables.map((provider) => (
              <button key={provider} className="button primary full" disabled={pending} onClick={() => setConfirming(provider)}>
                <Activity size={16} /> Connect {WEARABLE_COPY[provider].name}
              </button>
            ))}
            <button className="button secondary full" disabled={pending} onClick={() => void finish()}>
              <Check size={16} /> {pending ? "Finishing…" : wearables.length ? "Neither — finish" : "Finish"}
            </button>
          </>
        ) : (
          <button className="button primary full" disabled={pending} onClick={() => setStep(step + 1)}>
            Continue <ArrowRight size={16} />
          </button>
        )}
        <div className="wizard-footer">
          {step > 0 ? <button className="text-button" onClick={() => setStep(step - 1)}>Back</button> : <span />}
          <button className="text-button muted" disabled={pending} onClick={() => void finish({ skipAll: true })}>Skip setup</button>
        </div>
      </div>

      {confirming && (
        <ConnectSheet
          provider={confirming}
          pending={pending}
          onCancel={() => setConfirming(null)}
          onContinue={() => { const provider = confirming; setConfirming(null); void finish({ connectWearable: provider }); }}
        />
      )}
    </div>
  );
}

function ChoiceCard({ active, onClick, icon, title, badge, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; badge?: string; body: string }) {
  return (
    <button type="button" className={active ? "choice-card active" : "choice-card"} onClick={onClick}>
      <span className="choice-icon">{icon}</span>
      <span className="choice-copy">
        <strong>{title}{badge && <em>{badge}</em>}</strong>
        <small>{body}</small>
      </span>
      {active && <Check size={17} className="choice-check" />}
    </button>
  );
}
