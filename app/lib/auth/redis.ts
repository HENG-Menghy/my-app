// @/lib/auth/redis.ts

import { Redis } from "@upstash/redis";
import { Logger } from "@/lib/logger";
import { REDIS_PREFIXES } from "./constants";
import type {
  RedisSetOptions,
  RateLimitInfo,
  RateLimitConfig,
  RateLimitAction,
} from "@/types/redis";
import { randomUUID } from "crypto";
import { getTimeDifference } from "@/utils/getTimeDifference";

export class RedisClient {
  private static client: Redis;
  private static initialized = false;

  static initialize() {
    if (!this.initialized) {
      if (
        !process.env.UPSTASH_REDIS_REST_URL ||
        !process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        Logger.error(
          "REDIS_CREDENTIALS_ERROR",
          new Error("Redis credentials not configured correctly")
        );
      }

      this.client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      this.initialized = true;
      Logger.debug("REDIS_INITIALIZED_SUCCESSFULLY");
    }

    return this.client;
  }

  static async set(
    key: string,
    value: string,
    options?: RedisSetOptions
  ): Promise<"OK" | string | null> {
    try {
      const redis = this.initialize();
      const redisOptions: Record<string, any> = {};
      if (options?.px != null) {
        redisOptions.px = Number(options.px);
      }
      if (options?.ex != null) {
        redisOptions.ex = Number(options.ex);
      }
      if (options?.nx === true) {
        redisOptions.nx = true;
      }
      if (options?.xx === true) {
        redisOptions.xx = true;
      }

      return await redis.set(key, value, redisOptions);
    } catch (error) {
      Logger.error("REDIS_SET_ERROR", error as Error);
      return null;
    }
  }

  static async get(key: string): Promise<string | null> {
    try {
      const redis = this.initialize();
      return await redis.get(key);
    } catch (error) {
      Logger.error("REDIS_GET_ERROR", error as Error);
      return null;
    }
  }

  static async del(key: string): Promise<number> {
    try {
      const redis = this.initialize();
      return await redis.del(key);
    } catch (error) {
      Logger.error("REDIS_DEL_ERROR", error as Error);
      return 0;
    }
  }

  static async exists(key: string): Promise<number> {
    try {
      const redis = this.initialize();
      return await redis.exists(key);
    } catch (error) {
      Logger.error("REDIS_EXISTS_ERROR", error as Error);
      return 0;
    }
  }

  static async ttl(key: string): Promise<number> {
    try {
      const redis = this.initialize();
      return await redis.ttl(key);
    } catch (error) {
      Logger.error("REDIS_TTL_ERROR", error as Error);
      return 0;
    }
  }

  static async checkRateLimit(
    action: RateLimitAction,
    identifier: string,
    { points, duration, blockDuration }: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const redis = this.initialize();
    const now = Date.now();
    const windowStart = now - duration * 1000;

    const ratelimitKey = `${REDIS_PREFIXES.RATE_LIMIT}${action}:${identifier}`;
    const blockKey = `${REDIS_PREFIXES.BLOCK}${action}:${identifier}`;

    try {
      // Use Lua script for atomic operations
      const luaScript = `
        -- Check if blocked
        if redis.call('EXISTS', KEYS[2]) == 1 then
          local ttl = redis.call('TTL', KEYS[2])
          return { -1, ttl }
        end

        -- Get current second timestamp
        local currentSecond = math.floor(tonumber(ARGV[1]) / 1000)

        -- Clean old entries and get existing entries
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
        local keys = redis.call('ZRANGE', KEYS[1], 0, -1, 'WITHSCORES')

        -- Count unique seconds
        local seenSeconds = {}
        local uniqueCount = 0
        for i = 1, #keys, 2 do
          local keySecond = math.floor(tonumber(keys[i + 1]) / 1000)
          if not seenSeconds[keySecond] then
            seenSeconds[keySecond] = true
            uniqueCount = uniqueCount + 1
          end
        end

        -- Add new entry if not already counted in this second
        if not seenSeconds[currentSecond] then
          redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1] .. ':' .. ARGV[3])
          redis.call('EXPIRE', KEYS[1], ARGV[5])
          uniqueCount = uniqueCount + 1
        end

        -- Block if limit exceeded
        if uniqueCount > tonumber(ARGV[4]) then
          redis.call('SETEX', KEYS[2], ARGV[6], 'blocked')
          return { -1, tonumber(ARGV[6]) }
        end

        return { uniqueCount, 0 }
      `;

      const requestId = randomUUID();
      const result = await redis.eval(
        luaScript,
        [ratelimitKey, blockKey], // [KEYS[1], KEYS[2]]
        [
          now.toString(), // ARGV[1] - current timestamp
          windowStart.toString(), // ARGV[2] - window start time
          requestId, // ARGV[3] - unique request ID
          points, // ARGV[4] - max number of requests allowed
          duration, // ARGV[5] - window duration
          blockDuration, // ARGV[6] - block duration
        ]
      ) as [number, number];

      const [ count, blockTTL ] = result;

      if (count === -1) {
        Logger.debug("RATE_LIMIT_BLOCKED", {
          action,
          identifier,
          remaining: 0,
          resetIn: getTimeDifference(blockTTL),
          allowed: false,
          blocked: true,
        });

        return {
          allowed: false,
          remaining: 0,
          resetIn: blockTTL,
          blocked: true,
        }
      }

      if (count === points) {
        Logger.debug("RATE_LIMIT_EXCEEDED", {
          action,
          identifier,
          requestCounts: count,
          remaining: 0,
          resetIn: duration,
          allowed: false,
          blocked: false,
        });

        return {
          allowed: false,
          remaining: 0,
          resetIn: duration,
          blocked: false,
        }
      }

      if (count < points) {
        Logger.debug("RATE_LIMIT_ALLOW", {
          action, 
          identifier,
          requestCounts: count,
          remaining: points - count,
          allowed: true,
          blocked: false,
        });

        return {
          allowed: true,
          remaining: points - count,
          resetIn: duration,
          blocked: false,
        }
      }

      return {
        allowed: count < points,
        remaining:  Math.max(0, points - count),
        resetIn: duration,
        blocked: false
      }
    } catch (error) {
      Logger.error("RATE_LIMIT_ERROR", error as Error);

      return {
        allowed: false,
        remaining: 0,
        resetIn: duration,
        blocked: false,
      };
    }
  }
}