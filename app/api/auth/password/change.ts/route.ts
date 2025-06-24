// @/api/auth/password/change/route.ts

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { validateRequest } from '@/lib/api/validate'
import { passwordSchema } from '@/lib/validations/auth'
import { getAuthUser } from '@/lib/api/auth'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthUser(req)
    const body = await req.json()
    const data = await validateRequest(passwordSchema.change, body)

    await authService.changePassword(userId, data)

    return ApiResponse.success({
      message: 'Password changed successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}