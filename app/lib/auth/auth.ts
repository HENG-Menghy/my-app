// @/lib/auth/auth.ts

import { NextRequest } from "next/server";
import { JWT } from "../jwt";
import { Logger } from "../logger";
import { CookieManager } from "../cookies";
import { UserRole } from "@prisma/client";
import { COOKIES, REDIS_PREFIXES } from "../constants";
import { UpstashRedis } from "../upstash-redis";
import { AuthUserPayload } from "@/types/auth";

export async function getAuthUser(
  request: NextRequest
): Promise<AuthUserPayload | null> {
  try {
    const accessToken = CookieManager.get(COOKIES.ACCESS_TOKEN_NAME, {
      request,
    });
    if (!accessToken) return null;

    const payload = JWT.verifyAccessToken(accessToken);
    if (!payload) return null;

    const sessionId = payload.sid;
    const key = `${REDIS_PREFIXES.SESSION}${sessionId}`;
    const session = await UpstashRedis.get(key);
    if (!session) return null;
    
    return {
      userId: payload.uid,
      sessionId: payload.sid,
      email: payload.email,
      role: payload.role as UserRole,
    };
  } catch (error) {
    Logger.error("GET_AUTH_USER_ERROR", error as Error);
    return null;
  }
}
