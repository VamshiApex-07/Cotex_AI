import "dotenv/config"

import express from "express"
import connectDb from "./config/db.js"
import router from "./routes/agent.route.js"
import { assertInternalSecret, requireInternal, requireUser } from "../../shared/auth/internalAuth.js"


// dotenv/config has to be the first import, not a dotenv.config() call further
// down: ESM evaluates every import before any top-level statement, so anything
// imported below here — shared/redis/redis.js in particular — had already read
// process.env and constructed its client against an undefined REDIS_URL.
const REQUIRED_ENV = ["PORT", "MONGODB_URI", "REDIS_URL", "CHAT_SERVICE", "AUTH_SERVICE"]
const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
    console.error(`[agent] missing required env vars: ${missing.join(", ")}`)
    process.exit(1)
}

try {
    assertInternalSecret()
} catch (error) {
    console.error(`[agent] ${error.message}`)
    process.exit(1)
}

const port = process.env.PORT

const app = express()

app.disable("x-powered-by")
app.use(express.json())

app.get("/", (req, res) => {
    res.json({ message: "hello from agent" })
})

// Registered after the healthcheck so that stays reachable without credentials.
// requireInternal rejects anything that did not come through the gateway;
// requireUser then refuses requests with no well-formed identity, so no handler
// has to decide what to do about a missing x-user-id.
app.use("/", requireInternal, requireUser, router)

app.use((req, res) => {
    res.status(404).json({ code: "not_found", message: "Not found" })
})

app.use((err, req, res, next) => {
    console.error("[agent] unhandled error:", err?.message)
    console.error(err?.stack)
    if (res.headersSent) {
        return next(err)
    }
    // err.data is the deliberate client-facing payload the 429/402 throws carry;
    // anything else gets a generic body. The raw error is never interpolated into
    // the response.
    return res.status(typeof err?.status === "number" ? err.status : 500).json(
        err?.data ?? { code: "internal_error", message: "Something went wrong." }
    )
})

const startServer = async () => {
    try {
        await connectDb()
        app.listen(port, () => {
            console.log(`agent started at ${port}`)
        })
    } catch (error) {
        console.error(`[agent] server failed to start: ${error?.message}`)
        process.exit(1)
    }
}

startServer()
