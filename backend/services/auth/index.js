import "dotenv/config"

import express from "express"
import connectDb from "./config/db.js"
import authRouter from "./routes/auth.route.js"
import internalRouter from "./routes/internal.route.js"
import { assertInternalSecret, requireInternal } from "../../shared/auth/internalAuth.js"
const REQUIRED_ENV = ["PORT", "MONGODB_URI", "REDIS_URL"]
const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
    console.error(`[auth] missing required env vars: ${missing.join(", ")}`)
    process.exit(1)
}

try {
    assertInternalSecret()
} catch (error) {
    console.error(`[auth] ${error.message}`)
    process.exit(1)
}

const PORT = process.env.PORT

const app = express()

app.disable("x-powered-by")
// A Firebase ID token is a few KB; nothing on this service legitimately posts
// more, and the gateway proxy accepts 50mb.
app.use(express.json({ limit: "128kb" }))

app.get("/", (req, res) => {
    res.json({ message: "Hello from Auth" })
})

app.use("/internal", requireInternal, internalRouter)
app.use("/", authRouter)

app.use((req, res) => {
    res.status(404).json({ code: "not_found", message: "Not found" })
})

app.use((error, req, res, next) => {
    console.error("[auth] unhandled error:", error?.message)
    if (res.headersSent) {
        return next(error)
    }
    return res.status(typeof error?.status === "number" ? error.status : 500).json(
        error?.data ?? { code: "internal_error", message: "Something went wrong." }
    )
})

const startServer = async () => {
    try {
        await connectDb()
        app.listen(PORT, () => {
            console.log(`Auth started at ${PORT}`)
        })
    } catch (error) {
        console.error(`[auth] server failed to start: ${error?.message}`)
        process.exit(1)
    }
}

startServer()
