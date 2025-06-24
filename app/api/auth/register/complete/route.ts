// @/api/auth/register/complete/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { registerSchema } from '@/lib/validations/auth'
import { getSessionMetadata } from '@/lib/api/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = await validateRequest(registerSchema.complete, body)
    const metadata = await getSessionMetadata(request);
    await authService.completeRegistration(data, {
      ...metadata,
      actor: data.email,
      action: "Registered successfully",
    });

    return ApiResponse.success({
      message: 'Registration completed successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}