// @/lib/auth/cookies.ts

import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONSTANTS, COOKIES } from "./constants";

const options = COOKIES.OPTIONS;

export class CookieManager {
  // ACCESS TOKEN
  static setAccessTokenCookie(response: NextResponse, accessToken: string): void {
    response.cookies.set(COOKIES.ACCESS, accessToken, {
      ...options, 
      maxAge: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN
    });
  }

  static getAccessTokenCookie(request: NextRequest): string | null {
    return request.cookies.get(COOKIES.ACCESS)?.value ?? null;
  }

  static clearAccessTokenCookie(response: NextResponse): void {
    response.cookies.delete(COOKIES.ACCESS);
  }

  // REFRESH TOKEN
  static setRefreshTokenCookie(response: NextResponse, refreshToken: string): void {
    response.cookies.set(COOKIES.REFRESH, refreshToken, {
      ...options,
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  static getRefreshTokenCookie(request: NextRequest): string | null {
    return request.cookies.get(COOKIES.REFRESH)?.value ?? null;
  }

  static clearRefreshTokenCookie(response: NextResponse): void {
    response.cookies.delete(COOKIES.REFRESH);
  }

  // SESSION ID
  static setSessionCookie(response: NextResponse, sessionId: string): void {
    response.cookies.set(COOKIES.SESSION, sessionId, {
      ...options,
      maxAge: AUTH_CONSTANTS.SESSION_EXPIRY,
    });
  }

  static getSessionCookie(request: NextRequest): string | null {
    return request.cookies.get(COOKIES.SESSION)?.value ?? null;
  }

  static clearSessionCookie(response: NextResponse): void {
    response.cookies.delete(COOKIES.SESSION);
  }

  // DELETING COOKIES
  static clearAllCookies(response: NextResponse): void {
    this.clearAccessTokenCookie(response);
    this.clearRefreshTokenCookie(response);
    this.clearSessionCookie(response);
  }
}