// middleware.ts

import { getAuthUser } from "@/lib/auth/auth";
import { AUTH_CONSTANTS, COOKIES } from "@/lib/constants";
import { generateCSRFtoken, verifyCSRFtoken } from "@/lib/edge-csrf";
import { Logger } from "@/lib/logger";
import { GlobalRatelimit } from "@/lib/upstash-ratelimit";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const responseNext = NextResponse.next();
  const authUser = await getAuthUser(request);

  const isProtectedUserPath = /^\/user(\/|$)/.test(pathname);
  const isProtectedAdminPath = /^\/admin(\/|$)/.test(pathname);

  /* ─── Skip CSRF for QStash requests (trusted) ─── */
  if (request.headers.get("Upstash-Signature")) return responseNext;

  /* ─── CSRF Protection ─── */
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const invalidCSRFtokenResponse = NextResponse.json(
      {
        success: false,
        code: "FORBIDDEN",
        message: "MIDDLEWARE: Invalid CSRF token",
      },
      { status: 403 }
    );

    try {
      // // Read CSRF token from cookie
      const csrfTokenCookie =
        request.cookies.get(COOKIES.CSRF_TOKEN_NAME)?.value ?? "";

      // Read CSRF token from header
      const csrfTokenHeader = request.headers.get("x-csrf-token") ?? "";

      if (!csrfTokenHeader || csrfTokenHeader !== csrfTokenCookie) {
        return invalidCSRFtokenResponse;
      }

      // Verify cryptographic validity
      const isTokenValid = await verifyCSRFtoken(csrfTokenHeader);
      if (!isTokenValid) {
        return invalidCSRFtokenResponse;
      }
    } catch (error) {
      Logger.error("MIDDLEWARE_CSRF_TOKEN_ERROR", error as Error);
      return invalidCSRFtokenResponse;
    }
  } else {
    if (!request.cookies.has(COOKIES.CSRF_TOKEN_NAME)) {
      try {
        const csrfTokenCookie = await generateCSRFtoken();
        responseNext.cookies.set(COOKIES.CSRF_TOKEN_NAME, csrfTokenCookie, {
          ...COOKIES.OPTIONS,
          httpOnly: false,
          maxAge: AUTH_CONSTANTS.CSRF_TOKEN_EXPIRY,
        });
      } catch (error) {
        Logger.error("MIDDLEWARE_CSRF_TOKEN_ERROR", error as Error);
      }
    }
  }

  /* ─── Protect frontend routes ──── */
  // Block access to /api routes via browser
  if (/^\/api(\/|$)/.test(pathname)) {
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/notfound", request.url));
    }
  }

  // Protect user routes; required login
  if (isProtectedUserPath) {
    if (!authUser) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // Only admin can access admin routes
  if (isProtectedAdminPath) {
    if (!authUser || authUser.role !== UserRole.admin) {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  /* ─── Global rate limit, that allows 30 requests per 10 seconds ─── */
  try {
    const { success: allowed, remaining } = await GlobalRatelimit();
    if (allowed) {
      Logger.debug("GLOBAL_RATELIMIT_ALLOW", { allowed, remaining, window: "10 seconds" });
      return responseNext;
    } else {
      Logger.warn("GLOBAL_RATELIMIT_EXCEED", { allowed, remaining, window: "10 seconds" });
      return NextResponse.json(
        {
          success: false,
          code: "TOO_MANY_REQUESTS",
          message:
            "Too many requests in a 10-second window. Unable to process your request at this time.",
        },
        { status: 429 }
      );
    }
  } catch (error) {
    Logger.error("UPSTASH_RATELIMIT_ERROR", error as Error);
    return { success: false, remaining: -1, window: "10 seconds" };
  }
}

// ─── Matching Routes ───
export const config = {
  /*
   * Match all request paths except for the ones starting with:
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico, sitemap.xml, robots.txt (metadata files)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
