// @/types/redis.ts

import { AUTH_CONSTANTS } from '@/lib/auth/constants'

export interface RedisConfig {
  url: string;
  token: string;
}

export interface RedisSetOptions {
  px?: number | null; // Expiration in milliseconds
  ex?: number | null; // Expiration in seconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
  keepttl?: boolean; // Retain the TTL of the existing key
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetIn?: number;
  blocked?: boolean;
}

export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

export interface OTPData {
  email: string;
  type: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
  code: string;
  attempts: number;
  verified: boolean;
  expiresAt: Date;
}

// Rate Limit Key Types
export type RateLimitAction = keyof typeof AUTH_CONSTANTS.RATE_LIMITS
