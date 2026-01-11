// @/api/auth/password/reset/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { PasswordSchema } from "@/lib/validations/auth";
import { getSessionMetadata } from "@/lib/sessionMetadata";
import { maskEmail } from "@/utils/maskEmail";

export async function POST(request: NextRequest) {
  try {
    const metadata = await getSessionMetadata(request);
    const body = await request.json();
    const { email } = await validateRequest(PasswordSchema.reset, body);
    await authService.initiatePasswordReset({ email }, metadata);

    return ApiResponse.success({
      message: `An OTP code has been sent to your email address (${maskEmail(
        email
      )}). Please check your inbox to proceed with the password reset.`,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
