// @/api/auth/logout/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { COOKIES } from "@/lib/constants";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { CookieManager } from "@/lib/cookies";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();

    const { userId, sessionId } = authUser;
    await authService.logout(userId, sessionId);

    const response = ApiResponse.success({
      message: "Logged out successfully",
    });

    // Clear cookies
    CookieManager.delete(COOKIES.ACCESS_TOKEN_NAME, response);
    CookieManager.delete(COOKIES.REFRESH_TOKEN_NAME, response);

    return response;
  } catch (error) {
    return ApiResponse.error(error);
  }
}
