import "dotenv/config"

import dns from "node:dns"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import protect from "./middleware/auth.middleware.js"
import { getCurrentUser } from "./controllers/user.controller.js"
import { proxyWithHeader } from "./utils/proxyWithHeader.js"
import { assertInternalSecret } from "../shared/auth/internalAuth.js"

dns.setServers(["1.1.1.1", "8.8.8.8"])

const REQUIRED_ENV = [
    "PORT",
    "AUTH_SERVICE",
    "CHAT_SERVICE",
    "AGENT_SERVICE",
    "BILLING_SERVICE",
    "FRONTEND_URL",
    "REDIS_URL"
]

const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
    console.error(`[gateway] missing required env vars: ${missing.join(", ")}`)
    process.exit(1)
}

try {
    assertInternalSecret()
} catch (error) {
    console.error(`[gateway] ${error.message}`)
    process.exit(1)
}

const PORT = process.env.PORT

const app = express()

app.disable("x-powered-by")
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
app.use(morgan("dev"))
app.use(cookieParser())

// Only these two auth endpoints are reachable from the internet. The whole auth
// router used to be mounted here without `protect`, which meant POST
// /api/auth/update-plan and /api/auth/deduct-credits were open to anyone: a
// single unauthenticated request granted arbitrary credits and a paid plan to
// any userId. Those handlers now live under /internal on the auth service,
// require the shared internal secret, and are not proxied at all.
const PUBLIC_AUTH_PATHS = new Set(["/login", "/logout"])

const publicAuthOnly = (req, res, next) => {
    // req.url is mount-relative here, so "/api/auth/login" arrives as "/login".
    const pathname = req.url.split("?")[0].replace(/\/+$/, "") || "/"
    if (!PUBLIC_AUTH_PATHS.has(pathname)) {
        return res.status(404).json({ code: "not_found", message: "Not found" })
    }
    return next()
}

app.use("/api/auth", publicAuthOnly, proxyWithHeader(process.env.AUTH_SERVICE, { authenticated: false }))
app.use("/api/chat", protect, proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent", protect, proxyWithHeader(process.env.AGENT_SERVICE))
app.use("/api/billing", protect, proxyWithHeader(process.env.BILLING_SERVICE))
app.get("/api/me", protect, getCurrentUser)

app.get("/", (req, res) => {
    res.json({ message: "Hello from Gateway" })
})

app.use((req, res) => {
    res.status(404).json({ code: "not_found", message: "Not found" })
})

app.use((error, req, res, next) => {
    console.error("[gateway] unhandled error:", error?.message)
    if (res.headersSent) {
        return next(error)
    }
    return res.status(typeof error?.status === "number" ? error.status : 500).json({
        code: "gateway_error",
        message: "Something went wrong."
    })
})

app.listen(PORT, () => {
    console.log(`gateway started at ${PORT}`)
})
