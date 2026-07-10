import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const isAuthPage =
    request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";
  const hasSession = Boolean(getSessionCookie(request));
  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except auth API, static assets, and files with extensions.
  matcher: ["/((?!api/auth|api/photos|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
