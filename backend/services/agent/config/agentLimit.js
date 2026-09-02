import redis from "../../../shared/redis/redis.js"

const Limits = {
    chat: 20,
    coding: 5,
    pdf: 5,
    ppt: 5,
    vision: 5,
    search: 5
}

const WINDOW_SECONDS = 60

// INCR, then EXPIRE, then TTL as three round trips meant a crash or a failover in
// between left a counter with TTL -1 — a window that never rolls over, i.e. a
// permanent lockout for that user and agent. EVAL runs the whole thing inside
// Redis atomically, so there is no window to lose. Re-arming on any ttl < 0
// rather than only on count == 1 also repairs counters already stuck that way.
const WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`

export const checkAgentLimit = async (userId, agent) => {
    const max = Limits[agent] || Limits["chat"]
    const key = `rate:${userId}:${agent}`
    const [rawCount, rawTtl] = await redis.eval(WINDOW_SCRIPT, 1, key, WINDOW_SECONDS)
    const count = Number(rawCount)
    const ttl = Number(rawTtl)

    if (count > max) {
        const minutes = Math.floor(ttl / 60)
        const seconds = (ttl % 60)
        const time = minutes > 0 ? ` ${minutes}m : ${seconds}s` : `${seconds}s`

        const error = new Error(`Rate limit exceeded for ${agent}.`);
        error.status = 429
        error.data = {
            success: false,
            agent,
            limit: max,
            remainingTime: ttl,
            retryAfter: time,
            message: `You have reached the ${agent} limit (${max} requests/minute). Try again in ${time}.`
        }

        throw error
  
}

return {
    remaining: max - count,
    limit: max
 
}
  

   
}