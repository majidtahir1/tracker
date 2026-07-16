import { useState } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import { post } from "./api";

/**
 * Wearable connect flow shared by the onboarding wizard and Settings: an
 * explainer sheet (whose credentials to use, what access is granted), then
 * fetch the provider authorize URL from the API and open it in the system
 * browser. The webview holds a bearer token, which window.open can't carry,
 * so the callback identifies the user via the DB-backed OAuth state and
 * lands on the public /connected page.
 */

export type Provider = "whoop" | "fitbit";

export const WEARABLE_COPY: Record<Provider, { name: string; lead: string; steps: string[] }> = {
  whoop: {
    name: "WHOOP",
    lead: "Next you'll see WHOOP's own sign-in page. Use your WHOOP account — the same email and password as the WHOOP app — not your Progression login.",
    steps: [
      "Sign in on WHOOP's page",
      "Approve read-only access to recovery, sleep, and strain",
      "Return to the app when it says you're connected",
    ],
  },
  fitbit: {
    name: "Fitbit",
    lead: "Next you'll be sent to Google in your browser (Fitbit accounts are Google accounts). Pick the Google account your Fitbit app uses — not your Progression login.",
    steps: [
      "Choose your Google account",
      "Approve read-only access — if Google shows an “unverified app” notice, choose Continue",
      "Return to the app when it says you're connected",
    ],
  },
};

/** Fetch the authorize URL and hand off to the system browser. */
export async function startWearableAuth(provider: Provider): Promise<void> {
  const result = await post<{ url: string }>("/api/mobile/onboarding", {
    action: "wearableAuth",
    provider,
  });
  window.open(result.url, "_blank");
}

export function ConnectSheet({ provider, pending, onCancel, onContinue }: {
  provider: Provider;
  pending: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const copy = WEARABLE_COPY[provider];
  const target = provider === "fitbit" ? "Google" : copy.name;
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><strong>Connect {copy.name}</strong><button className="icon-button" onClick={onCancel}><X size={18} /></button></div>
        <p className="connect-lead">{copy.lead}</p>
        <ol className="connect-steps">{copy.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        <p className="connect-note"><ShieldCheck size={14} /> Progression never sees your {target} password. Disconnect anytime.</p>
        <button className="button primary full" disabled={pending} onClick={onContinue}>
          Continue to {target} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Settings row for a wearable: status plus a Connect button when the server
 * has the integration configured and the account isn't connected yet.
 */
export function WearableRow({ label, provider, status, onStarted }: {
  label: string;
  provider: Provider;
  status: { configured: boolean; connected: boolean };
  onStarted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function proceed() {
    setPending(true); setError("");
    try {
      await startWearableAuth(provider);
      setConfirming(false);
      onStarted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start the connection.");
    } finally { setPending(false); }
  }

  return <>
    <div className="setting-row">
      <strong>{label}</strong>
      {status.connected
        ? <span>Connected</span>
        : status.configured
          ? <button className="button secondary connect-inline" onClick={() => setConfirming(true)}>Connect</button>
          : <span>Not available</span>}
    </div>
    {error && <p className="notice">{error}</p>}
    {confirming && <ConnectSheet provider={provider} pending={pending} onCancel={() => setConfirming(false)} onContinue={() => void proceed()} />}
  </>;
}
