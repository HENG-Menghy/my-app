// @/api/auth/login/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { loginSchema } from "@/lib/validations/auth";
import { CookieManager } from "@/lib/auth/cookies";
import { getSessionMetadata } from "@/lib/api/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = await validateRequest(loginSchema, body);
    const metadata = await getSessionMetadata(request);
    const { user, session, tokens } = await authService.login({ email, password }, {
      ...metadata,
      actor: email,
      action: "Logged in successfully",
    });

    const response = ApiResponse.success({
      message: "Logged in successfully",
      data: { user, session, tokens },
    });

    CookieManager.setRefreshTokenCookie(response, tokens.refreshToken);

    return response;
  } catch (error) {
    return ApiResponse.error(error);
  }
}
