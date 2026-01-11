// @/api/auth/register/complete/route.ts

import { NextRequest } from "next/server";
import { authService } from "@/services/authService";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { RegisterSchema } from "@/lib/validations/auth";
import { getSessionMetadata } from "@/lib/sessionMetadata";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await validateRequest(RegisterSchema.complete, body);
    const metadata = await getSessionMetadata(request);
    await authService.completeRegistration(data, metadata);
    return ApiResponse.success({
      message: "Registration is completed successfully",
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
