import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes never require a session. API auth routes are public by design;
 * every other `/api/*` route is also allowed through because it validates its
 * own bearer token.
 */
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api",
  "/api/auth",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/refresh",
  "/api/auth/recover",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return NextResponse.next();
  }

  // Static assets are always allowed.
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // AuthProvider writes this marker after login. The bearer token itself stays
  // in localStorage and is validated by the API on every request.
  const session = request.cookies.get("relay.session")?.value;

  if (session !== "1") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
