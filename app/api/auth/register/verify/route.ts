// @/api/auth/register/verify/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { registerSchema } from '@/lib/validations/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, otp } = await validateRequest(registerSchema.verify, body)

    await authService.verifyRegistrationOTP({ email, otp })

    return ApiResponse.success({
      message: 'Your email verified successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}