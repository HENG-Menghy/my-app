// @/api/auth/register/verify/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { RegisterSchema } from '@/lib/validations/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await validateRequest(RegisterSchema.verify, body);
    await authService.verifyRegistrationOTP(data);
    return ApiResponse.success({
      message: 'Your email is verified successfully'
    });
  } catch (error) {
    return ApiResponse.error(error)
  }
}