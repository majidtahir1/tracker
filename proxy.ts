import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// OAuth callbacks and the post-OAuth landing page must work without a
// session: on mobile the flow finishes in Safari, not the app's webview.
// Callbacks identify the user via the single-use DB state (lib/oauth-state).
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/connected",
  "/privacy",
  "/support",
  "/api/whoop/callback",
  "/api/fitbit/callback",
  "/api/cron/notify", // bearer-token protected (CRON_SECRET), no session
]);

export function proxy(request: NextRequest) {
  const isPublic =
    PUBLIC_PATHS.has(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/api/mobile/");
  const hasSession = Boolean(getSessionCookie(request));
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except auth API, static assets, and files with extensions.
  matcher: ["/((?!api/auth|api/photos|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
