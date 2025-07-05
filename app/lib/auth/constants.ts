// @/lib/auth/constants.ts

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRES_IN: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7 days in seconds
  SESSION_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  OTP_EXPIRY: 60, // 1 minutes in seconds
  EMAIL_VERIFIED_EXPIRY: 10 * 60, // 10 minutes in seconds
  MAX_ATTEMPTS: 5,
  MAX_ACTIVE_SESSIONS: 3,

  RATE_LIMITS: {
    OTP_REQUEST: {
      points: 5,
      duration: 10 * 60,
      blockDuration: 30 * 60
    },

    LOGIN: {
      points: 5,
      duration: 30 * 60,
      blockDuration: 2 * 60 * 60
    },  
  }
}

export const REDIS_PREFIXES = {
  SESSION: 'session:',
  USER_SESSION: 'user_session:',
  REFRESH_TOKEN: 'refresh:',
  OTP: 'otp:',
  RATE_LIMIT: 'rate_limit:',
  BLOCK: 'block:',
}

export const COOKIES = {
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
  SESSION: 'sessionId',
  OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'strict' as const,
  }
}