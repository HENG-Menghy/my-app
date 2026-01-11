// @/types/redis.ts

import { AUTH_CONSTANTS } from "@/lib/constants";

export interface OTPData {
  email: string;
  type: "VERIFY_EMAIL" | "RESET_PASSWORD";
  code: string;
  attempts: number;
  verified: boolean;
  expiresAt: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export interface RateLimitConfig {
  count: number;
  duration: number;
}

// Rate Limit Key Actions Types
export type RateLimitActions = keyof typeof AUTH_CONSTANTS.RATE_LIMITS;
