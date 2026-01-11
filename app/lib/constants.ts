// @/lib/constants.ts

export const AUTH_CONSTANTS = {
  SESSION_EXPIRY: 2 * 60, // 14 days in seconds
  REFRESH_TOKEN_EXPIRY: 2 * 60, // 14 days in seconds
  ACCESS_TOKEN_EXPIRY: 30, // 15 minutes in seconds
  CSRF_TOKEN_EXPIRY: 30 * 60, // 30 minutes in seconds
  OTP_EXPIRY: 2 * 60, // 2 minutes in seconds
  EMAIL_VERIFIED_EXPIRY: 10 * 60, // 10 minutes in seconds
  ACCOUNT_BLOCKED_EXPIRY: 3 * 24 * 60 * 60, // 3 days in seconds

  /** 
   * Sliding Window Rate Limiting
   * Sliding window length = 24 hours
   * Per-User rate limit for attempting to sensitive endpoints
  */
  RATE_LIMITS: {
    LOGIN: {
      count: 5, // max attempts per-user for a day
      duration: 24 * 60 * 60, // sliding window length
    },

    PASSWORD_CHANGE: {
      count: 3,
      duration: 24 * 60 * 60,
    },

    PASSWORD_RESET: {
      count: 3,
      duration: 24 * 60 * 60,
    },

    UPDATE_PROFILE: {
      count: 3,
      duration: 24 * 60 * 60,
    },

    OTP_VERIFY: {
      count: 5,
      duration: 24 * 60 * 60,
    },

    OTP_RESET: {
      count: 5,
      duration: 24 * 60 * 60,
    },
  },
};

export const REDIS_PREFIXES = {
  SESSION: "session:",
  OTP: "otp:",
  RATE_LIMIT: "rate_limit:",
  BLOCK: "block:",
  RATE_LIMIT_GLOBAL: "rate_limit:global",
  BLOCK_GLOBAL: "block:global",
};

export const COOKIES = {
  ACCESS_TOKEN_NAME: "access_token" as const,
  REFRESH_TOKEN_NAME: "refresh_token" as const,
  CSRF_TOKEN_NAME: "csrf_token" as const,
  OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "strict" as const,
  },
};
