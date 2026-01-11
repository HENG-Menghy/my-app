// @/api/auth/csrf-token/route.ts

import { NextRequest } from "next/server";
import { COOKIES } from "@/lib/constants";
import { ApiResponse } from "@/lib/api/response";
import { CookieManager } from "@/lib/cookies";
import { generateCSRFtoken } from "@/lib/edge-csrf";

export async function GET(request: NextRequest) {
  try {
    const csrfTokenCookie = request.cookies.get(COOKIES.CSRF_TOKEN_NAME);
    if (csrfTokenCookie) {
      const csrfToken = csrfTokenCookie.value;
      return ApiResponse.success({
        message: "CSRF token cookie still alive",
        data: { csrfToken },
      });
    }

    const csrfToken = await generateCSRFtoken();
    const response = ApiResponse.success({
      message:
        "New CSRF token was generated and stored in cookies successfully",
      data: { csrfToken },
    });
    CookieManager.set(COOKIES.CSRF_TOKEN_NAME, csrfToken, response);
    return response;
  } catch (error) {
    return ApiResponse.error(error);
  }
}
