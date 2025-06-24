// @/api/auth/logout/route.ts

import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { COOKIES } from '@/lib/auth/constants'
import { getAuthUser } from '@/lib/api/auth'

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId } = await getAuthUser(req)
    await authService.logout(userId, sessionId)

    // Clear cookies
    const cookieStore = await cookies()
    cookieStore.set(COOKIES.ACCESS_TOKEN, '', { maxAge: 0 })
    cookieStore.set(COOKIES.REFRESH_TOKEN, '', { maxAge: 0 })

    return ApiResponse.success({
      message: 'Logged out successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}