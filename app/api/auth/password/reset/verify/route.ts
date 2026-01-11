// @/api/auth/password/reset/verify/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { PasswordSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = await validateRequest(PasswordSchema.verify, body)

    await authService.verifyPasswordResetOTP(data)

    return ApiResponse.success({
      message: 'OTP reset code verified successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}