/**
 * POST /api/mobile/onboarding — the iOS shell's first-run wizard backend.
 * Two actions:
 *   "complete"     — mirror of the web completeOnboarding server action
 *                    (lib/onboarding-server.ts does the actual writes).
 *   "wearableAuth" — return the provider authorize URL. The webview holds a
 *                    bearer token, which window.open cannot carry, so the app
 *                    fetches the URL here and opens it in the system browser;
 *                    the OAuth callback identifies the user by the DB-backed
 *                    single-use state (lib/oauth-state.ts).
 */
import { auth } from "@/lib/auth";
import { completeOnboardingForUser } from "@/lib/onboarding-server";
import { wearableAuthorizeUrl } from "@/lib/wearable-auth";

export const dynamic = "force-dynamic";

const PROGRAM_CHOICES = new Set(["starter", "ai", "manual", "skip"]);

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  if (body.action === "complete") {
    const programChoice = body.programChoice;
    if (typeof programChoice !== "string" || !PROGRAM_CHOICES.has(programChoice)) {
      return Response.json({ error: "Invalid program choice" }, { status: 400 });
    }
    const bodyWeightLb = body.bodyWeightLb;
    if (bodyWeightLb != null && typeof bodyWeightLb !== "number") {
      return Response.json({ error: "Invalid body weight" }, { status: 400 });
    }
    const result = await completeOnboardingForUser(session.user.id, {
      bodyWeightLb: bodyWeightLb ?? null,
      programChoice: programChoice as "starter" | "ai" | "manual" | "skip",
    });
    return Response.json({ data: result }, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "wearableAuth") {
    if (body.provider !== "whoop" && body.provider !== "fitbit") {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }
    const url = await wearableAuthorizeUrl(session.user.id, body.provider);
    if (!url) {
      return Response.json({ error: "This integration is not configured on the server" }, { status: 503 });
    }
    return Response.json({ data: { url } });
  }

  return Response.json({ error: "Unknown onboarding action" }, { status: 400 });
}
