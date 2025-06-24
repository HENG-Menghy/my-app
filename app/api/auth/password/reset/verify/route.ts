// @/api/auth/password/reset/verify/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { passwordSchema } from '@/lib/validations/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = await validateRequest(passwordSchema.verify, body)

    await authService.verifyPasswordResetOTP(data)

    return ApiResponse.success({
      message: 'Code verified successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}