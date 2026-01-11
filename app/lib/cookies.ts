// @/lib/cookies.ts

import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONSTANTS, COOKIES } from "./constants";
import { Logger } from "./logger";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import Cookies from "js-cookie";

type CookieName =
  | typeof COOKIES.CSRF_TOKEN_NAME
  | typeof COOKIES.ACCESS_TOKEN_NAME
  | typeof COOKIES.REFRESH_TOKEN_NAME

export class CookieManager {
  /* Get token cookie */
  static get(
    name: CookieName,
    options?:
      | { request: NextRequest; cookieStore?: never }
      | { cookieStore: ReadonlyRequestCookies; request?: never }
  ): string | null {
    try {
      // Client component only allowed for csrf_token
      if (typeof window !== "undefined") {
        if (name === COOKIES.CSRF_TOKEN_NAME) return Cookies.get(name) ?? null;
        Logger.warn(`Tried to access secure cookie ‘${name}’ on client`);
        return null;
      }

      // Server component or API route
      const { request, cookieStore } = options || {};
      if (request) return request.cookies.get(name)?.value ?? null;
      if (cookieStore) return cookieStore.get(name)?.value ?? null;
      return null;
    } catch (error) {
      Logger.error(`GET_${name?.toUpperCase()}_COOKIE_ERROR`, error as Error);
      return null;
    }
  }

  /* Set token cookie */
  static set(name: CookieName, value: string, response?: NextResponse): void {
    try {
      let tokenAge: number = 0;
      if (name === COOKIES.CSRF_TOKEN_NAME) {
        tokenAge = AUTH_CONSTANTS.CSRF_TOKEN_EXPIRY;
      } else if (name === COOKIES.ACCESS_TOKEN_NAME) {
        tokenAge = AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY;
      } else if (name === COOKIES.REFRESH_TOKEN_NAME) {
        tokenAge = AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY;
      }

      // Client component only allowed for csrf_token
      if (typeof window !== "undefined") {
        if (name === COOKIES.CSRF_TOKEN_NAME) {
          Cookies.set(name, value, {
            ...COOKIES.OPTIONS,
            httpOnly: false,
            maxAge: tokenAge / 86400, // maxAge is in seconds, but js-cookie expects days
          });
        } else {
          Logger.warn(`Tried to set secure cookie ‘${name}’ on client`);
        }
        return;
      }

      // API route
      response?.cookies.set(name, value, {
        ...COOKIES.OPTIONS,
        httpOnly: name !== COOKIES.CSRF_TOKEN_NAME,
        maxAge: tokenAge,
      });
    } catch (error) {
      Logger.error(`SET_${name.toUpperCase()}_COOKIE_ERROR`, error as Error);
    }
  }

  /* Delete token cookie */
  static delete(name: CookieName, response?: NextResponse): void {
    try {
      // Client component only allowed for csrf_token
      if (typeof window !== "undefined") {
        if (name === COOKIES.CSRF_TOKEN_NAME) Cookies.remove(name);
        else Logger.warn(`Tried to delete secure cookie ‘${name}’ on client`);
        return;
      }

      // API route
      response?.cookies.delete(name);
    } catch (error) {
      Logger.error(`DELETE_${name.toUpperCase()}_COOKIE_ERROR`, error as Error);
    }
  }
}
