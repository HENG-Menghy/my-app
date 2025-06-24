// @/lib/api/response.ts

import { AuthError } from '@/lib/auth/errors'
import { Logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class ApiResponse {
  static success<T = any>(options: {
    message?: string
    data?: T
    status?: number
  }) {
    return NextResponse.json({
      success: true,
      message: options.message,
      data: options.data
    }, { 
      status: options.status || 200
    })
  }

  static error(error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({
        success: false,
        code: error.code,
        message: error.message
      }, {
        status: error.status
      })
    }

    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        code: 'VALIDATION_ERROR',
        details: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      }, {
        status: 422
      })
    }

    Logger.error('API_ERROR', error as Error)

    return NextResponse.json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }, {
      status: 500
    })
  }
}