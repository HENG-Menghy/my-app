// @/lib/lua-limiter.ts

export const LUA_LIMITER = `
-- KEYS:
-- KEYS[1] - rate limit key

-- ARGV:
-- ARGV[1] - now_ms = Date.now()
-- ARGV[2] - windowStart_ms = now_ms - windowDuration * 1000
-- ARGV[3] - maxAttempts
-- ARGV[4] - windowDuration
-- ARGV[5] - requestId = crypto.randomUUID() 

-- Check if exceeded
local attemptsCount = redis.call('ZCARD', KEYS[1])
if attemptsCount > tonumber(ARGV[3]) then
  local ttl = redis.call('TTL', KEYS[1])
  return { false, 0, ttl}
end

-- Clean old entries that outside the sliding window length (score)
-- redis.call('ZREMRANGEBYSCORE', key, min, max)
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, tonumber(ARGV[2]))

-- Add new request with current timestamp as score in set stored at KEYS[1]
-- redis.call('ZADD', key, score, member)
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]), tostring(ARGV[5]) .. ':' .. tostring(ARGV[1]))

-- Keep TTL on the sliding window
-- redis.call('EXPIRE', key, expiration)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))

-- Count number of elements in set stored at KEYS[1] in the current window
local attemptsCount = redis.call('ZCARD', KEYS[1])

-- Check the remaining attempts before it exceeds limit
local remaining = tonumber(ARGV[3]) - attemptsCount

-- If exceeds, return false
if attemptsCount > tonumber(ARGV[3]) then
  return { false, 0, tonumber(ARGV[4])}
end

-- Allowed, return true
return { true, remaining, 0 }
`;
