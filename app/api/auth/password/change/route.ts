// @/api/auth/password/change/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { getSessionMetadata } from "@/lib/sessionMetadata";
import { PasswordSchema } from "@/lib/validations/auth";
import { authService } from "@/services/authService";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    const { userId, sessionId } = authUser;

    const metadata = await getSessionMetadata(request);
    const body = await request.json();
    const changePasswordData = await validateRequest(PasswordSchema.change, body);
    await authService.changePassword(userId, sessionId, changePasswordData, metadata);
    return ApiResponse.success({
      message: "Your password was changed successfully",
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
