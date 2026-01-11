// @/lib/upstash-ratelimit.ts

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { REDIS_PREFIXES } from "./constants";

/**
 * Sliding window rate limiting.
 * Global rate limit to prevent burst requests access into the system.
 * @reference https://upstash.com/blog/upstash-ratelimit
 *
 */

// Limit number of overall requests access into the system, that allows only 30 requests in a 10-second window
export async function GlobalRatelimit(): Promise<{
  success: boolean;
  remaining: number;
}> {
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    prefix: REDIS_PREFIXES.RATE_LIMIT_GLOBAL,
    limiter: Ratelimit.slidingWindow(30, "10 s"),
  });

  const { success, remaining } = await ratelimit.limit("requests");

  return { success, remaining };
}
