// middleware.ts

import { getAuthUser } from "@/lib/api/auth";
import { AuthError } from "@/lib/auth/errors";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const user = getAuthUser(request);

  const isProtectedUserPath = /^\/user(\/|$)/.test(pathname);
  const isProtectedAdminPath = /^\/admin(\/|$)/.test(pathname);

  /* ─── API Routes ─── */
  if (pathname.startsWith("/api/")) {
    // If not authenticated, allow GET only
    if (!user) {
      if (method !== "GET") {
        throw AuthError.unauthorized();
      }
      return NextResponse.next();
    }

    // Special case: Allow full access to /api/booking for both user and admin
    if (pathname.startsWith("/api/booking/")) {
      return NextResponse.next();
    }

    // Allow GET for all users
    if (method === "GET") {
      return NextResponse.next();
    }

    // Allow only admin to use non-GET methods
    if (user.role !== "admin") {
      throw AuthError.forbidden();
    }

    return NextResponse.next();
  }

  /* ─── Frontend Routes ──── */
  // Protect admin and user routes; required login
  if (isProtectedUserPath || isProtectedAdminPath) {
    if (!user) {
      // Custom unauthorized page
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // Only admin can access / admin routes
  if (isProtectedAdminPath) {
    if (user && user.role !== "admin") {
      // Custom forbidden page
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  // Only user can access / user routes
  if (isProtectedUserPath) {
    if (user && user.role !== "user") {
      // Custom forbidden page
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  // All public pages allowed for everyone
  return NextResponse.next();
}

// ─── Matching Routes ───
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};