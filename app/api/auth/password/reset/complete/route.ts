// @/api/auth/password/reset/complete/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { PasswordSchema } from '@/lib/validations/auth'
import { getSessionMetadata } from '@/lib/sessionMetadata'

export async function POST(request: NextRequest) {
  try {
    const metadata = await getSessionMetadata(request);
    const body = await request.json()
    const data = await validateRequest(PasswordSchema.complete, body)

    await authService.completePasswordReset(data, metadata);

    return ApiResponse.success({
      message: 'Password reset completed successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}