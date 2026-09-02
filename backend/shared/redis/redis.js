import Redis from "ioredis"

if (!process.env.REDIS_URL) {
    // Entry points must `import "dotenv/config"` as their first import. ESM
    // evaluates imports before any top-level statement, so a later
    // dotenv.config() call runs after this module has already been constructed
    // — which is how every service silently ended up pointing at localhost.
    throw new Error("REDIS_URL is not set. Load dotenv before importing shared/redis.")
}

const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000)
})

redis.on("connect", () => {
    console.log("Redis Connected")
})

// An unhandled 'error' event on an EventEmitter terminates the process. Without
// this listener a single Redis blip took down the gateway, and with it every
// authenticated request in the system.
redis.on("error", (error) => {
    console.error("[redis] error:", error?.message)
})

export default redis
