// @/api/auth/session/user

import { NextRequest } from 'next/server'
import { authService } from '@/services/authService'
import { ApiResponse } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { sessionService } from '@/services/sessionService'
import { FormattedDateDisplay } from '@/utils/datetime'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getAuthUser(req)
    const sessions = await sessionService.getUserSessions(userId)

    return ApiResponse.success({
      message: `All active/valid sessions belong to user - ${userId}`,
      data: FormattedDateDisplay(sessions)
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, sessionId } = await getAuthUser(req)
    await authService.logoutAll(userId, sessionId);

    return ApiResponse.success({
      message: 'All other sessions of user terminated successfully'
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}