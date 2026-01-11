// @/api/auth/register/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { RegisterSchema } from "@/lib/validations/auth";
import { getSessionMetadata } from "@/lib/sessionMetadata";
import { maskEmail } from "@/utils/maskEmail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = await validateRequest(RegisterSchema.initial, body);
    const metadata = await getSessionMetadata(req);
    await authService.initiateRegistration({ email }, metadata);
    return ApiResponse.success({
      message: `The verification code was sent to your email address (${maskEmail(email)}).`,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
