import "dotenv/config"

import express from "express"
import connectDb from "./config/db.js"
import router from "./routes/billing.route.js"
import { assertInternalSecret, requireInternal } from "../../shared/auth/internalAuth.js"
const REQUIRED_ENV = ["PORT", "MONGODB_URI", "AUTH_SERVICE", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
    console.error(`[billing] missing required env vars: ${missing.join(", ")}`)
    process.exit(1)
}

try {
    assertInternalSecret()
} catch (error) {
    console.error(`[billing] ${error.message}`)
    process.exit(1)
}

const port = process.env.PORT

const app = express()

app.disable("x-powered-by")
app.use(express.json({ limit: "128kb" }))

app.get("/", (req, res) => {
    res.json({ message: "hello from billing" })
})

// The gateway stamps the internal secret on everything it proxies, so requiring
// it here means the service refuses traffic that reached port 8004 directly —
// docker-compose defines no network isolation, only a redis service.
app.use("/", requireInternal, router)

app.use((req, res) => {
    res.status(404).json({ code: "not_found", message: "Not found" })
})

app.use((error, req, res, next) => {
    console.error("[billing] unhandled error:", error?.message)
    if (res.headersSent) {
        return next(error)
    }
    return res.status(typeof error?.status === "number" ? error.status : 500).json(
        error?.data ?? { code: "internal_error", message: "Something went wrong." }
    )
})

// connectDb used to be called inside the listen callback, so the port was open
// and accepting payment traffic before Mongo was reachable.
const startServer = async () => {
    try {
        await connectDb()
        app.listen(port, () => {
            console.log(`billing started at ${port}`)
        })
    } catch (error) {
        console.error(`[billing] server failed to start: ${error?.message}`)
        process.exit(1)
    }
}

startServer()
