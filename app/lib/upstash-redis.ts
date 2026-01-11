// @/lib/upstash-redis.ts

/**
 * Create an Upstash Redis database in seconds.
 * How to use Upstash Redis? Please follow the docs:
 * Create an Upstash account here: https://console.upstash.com/auth/sign-in
 * Create an Upstash Redis database: https://upstash.com/docs/redis/overall/getstarted
 * @connect  https://upstash.com/docs/redis/howto/connectwithupstashredis
 * @commands https://redis.io/docs/latest/commands/
 *
 */

import { Redis } from "@upstash/redis";
import { Logger } from "@/lib/logger";
import { REDIS_PREFIXES } from "./constants";
import type {
  RateLimitInfo,
  RateLimitConfig,
  RateLimitActions,
} from "@/types/redis";
import { getTimeDifference } from "@/utils/getTimeDifference";
import { LUA_LIMITER } from "./lua-limiter";
import { maskEmail } from "@/utils/maskEmail";

export class UpstashRedis {
  private static upstashRedis: Redis = Redis.fromEnv();

  static async set(
    key: string,
    value: string,
    expiry: number
  ): Promise<"OK" | null> {
    try {
      const redis = this.upstashRedis;
      return (await redis.set(key, value, { ex: expiry })) as "OK";
    } catch (error) {
      Logger.error("REDIS_SET_ERROR", error as Error);
      return null;
    }
  }

  static async get(key: string): Promise<string | null> {
    try {
      const redis = this.upstashRedis;
      return await redis.get(key);
    } catch (error) {
      Logger.error("REDIS_GET_ERROR", error as Error);
      return null;
    }
  }

  static async del(key: string): Promise<number> {
    try {
      const redis = this.upstashRedis;
      return await redis.del(key);
    } catch (error) {
      Logger.error("REDIS_DEL_ERROR", error as Error);
      return 0;
    }
  }

  static async exists(key: string): Promise<number> {
    try {
      const redis = this.upstashRedis;
      return await redis.exists(key);
    } catch (error) {
      Logger.error("REDIS_EXISTS_ERROR", error as Error);
      return 0;
    }
  }

  static async ttl(key: string): Promise<number> {
    try {
      const redis = this.upstashRedis;
      return await redis.ttl(key);
    } catch (error) {
      Logger.error("REDIS_TTL_ERROR", error as Error);
      return 0;
    }
  }

  static async checkRateLimit(
    identifier: string,
    action: RateLimitActions,
    rateLimitConfig: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const redis = this.upstashRedis;
    const actor = identifier.includes("@") ? maskEmail(identifier) : identifier;

    // config
    const { count, duration } = rateLimitConfig;

    // key
    const rateLimitKey = `${REDIS_PREFIXES.RATE_LIMIT}${action}:${identifier}`; // KEYS[1]

    // arguments
    const now_ms = Date.now(); // ARGV[1]
    const windowStart_ms = now_ms - duration * 1000; // ARGV[2]
    const maxAttempts = count; // ARGV[3]
    const windowDuration = duration; // ARGV[4]
    const requestId = crypto.randomUUID(); // ARGV[5]

    // Runs Lua Script by wrapping it in TypeScript
    const result = (await redis.eval(
      LUA_LIMITER,
      [rateLimitKey],
      [now_ms, windowStart_ms, maxAttempts, windowDuration, requestId]
    )) as [number, number, number];

    const [status, remaining, ttl] = result;
    const allowed = !!status;

    if (!allowed) {
      Logger.warn("PER_USER_RATELIMIT_EXCEED", {
        allowed,
        remaining,
        resetIn: getTimeDifference(ttl),
        window: getTimeDifference(windowDuration),
        action,
        actor,
      });

      return {
        allowed,
        remaining,
        resetIn: ttl,
      };
    }

    Logger.debug("PER_USER_RATELIMIT_ALLOW", {
      allowed,
      remaining,
      window: getTimeDifference(windowDuration),
      action,
      actor,
    });

    return {
      allowed,
      remaining,
      resetIn: ttl,
    };
  }
}
