// @/lib/api/auth.ts

import { NextRequest } from "next/server";
import { AuthError } from "../auth/errors";
import { JWT } from "../auth/jwt";
import { Logger } from "../logger";
import { UserRole } from "@prisma/client";

interface AuthUser {
  userId: string;
  sessionId: string;
  email: string;
  role: UserRole;
}

export function getAuthUser(request: NextRequest): AuthUser {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) throw AuthError.unauthorized();

    const payload = JWT.verifyAccessToken(token);
    if (!payload?.uid || !payload?.sid || !payload?.email || !payload?.role) {
      throw AuthError.unauthorized();
    }

    return {
      userId: payload.uid,
      sessionId: payload.sid,
      email: payload.email,
      role: payload.role as UserRole,
    };
  } catch (error) {
    Logger.error("AUTH_USER_RETRIEVAL_ERROR", error as Error);
    throw AuthError.unauthorized();
  }
}