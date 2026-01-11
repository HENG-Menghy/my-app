// @/api/auth/login/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { LoginSchema } from "@/lib/validations/auth";
import { CookieManager } from "@/lib/cookies";
import { getSessionMetadata } from "@/lib/sessionMetadata";
import { COOKIES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = await validateRequest(LoginSchema, body);
    const metadata = await getSessionMetadata(request);
    const tokens = await authService.login(
      { email, password },
      metadata
    );
    const response = ApiResponse.success({
      message: "Logged in successfully",
    });
    CookieManager.set(COOKIES.ACCESS_TOKEN_NAME, tokens.accessToken, response);
    CookieManager.set(COOKIES.REFRESH_TOKEN_NAME, tokens.refreshToken, response);
    return response;
  } catch (error) {
    return ApiResponse.error(error);
  }
}
