// @/api/auth/refresh/route.ts

import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { CookieManager } from "@/lib/cookies";
import { COOKIES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = CookieManager.get(COOKIES.REFRESH_TOKEN_NAME, { request });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
