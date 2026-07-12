/**
 * /connected — public post-OAuth landing page for session-less browsers
 * (mobile: the flow finishes in Safari while the login session lives in the
 * app's webview). No auth, no user data — just tells the user whether the
 * connection worked and to return to the app.
 */
import { CheckCircle2, CircleAlert } from "lucide-react";

export const metadata = { title: "Connection status" };

const PROVIDER_NAMES: Record<string, string> = { whoop: "WHOOP", fitbit: "Fitbit" };

const FAILURE_TEXT: Record<string, string> = {
  denied: "The connection was denied — authorize access to sync.",
  state_mismatch: "The connection failed a security check. Open the app and try again.",
  error: "The connection failed. Open the app and try again.",
};

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; status?: string }>;
}) {
  const { provider, status } = await searchParams;
  const name = PROVIDER_NAMES[provider ?? ""] ?? "The service";
  const ok = status === "connected";

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-8 text-center">
        {ok ? (
          <CheckCircle2 className="mx-auto size-10 text-success" strokeWidth={1.5} />
        ) : (
          <CircleAlert className="mx-auto size-10 text-danger" strokeWidth={1.5} />
        )}
        <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-text">
          {ok ? `${name} connected` : `${name} connection failed`}
        </h1>
        <p className="mt-2 text-sm text-text-2">
          {ok
            ? `${name} is linked and your data is syncing. You can close this window and return to the Progression app.`
            : (FAILURE_TEXT[status ?? ""] ?? FAILURE_TEXT.error)}
        </p>
      </div>
    </div>
  );
}
