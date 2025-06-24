// @/api/auth/register/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { registerSchema } from '@/lib/validations/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = await validateRequest(registerSchema.initial, body)

    await authService.initiateRegistration({ email })

    return ApiResponse.success({
      message: 'Verification code was successfully sent to your email'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}