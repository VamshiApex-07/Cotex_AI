// First import so every module below sees a populated process.env: ESM evaluates
// all imports before any top-level statement, which the old dotenv.config() call
// ran too late to guarantee.
import "dotenv/config"
import express from "express"
import connectDb from "./config/db.js"
import router from "./routes/chat.routes.js"
import { assertInternalSecret, requireInternal } from "../../shared/auth/internalAuth.js"
const PORT = process.env.PORT
const app=express()
// The gateway proxies with a 50mb ceiling; the express default of 100kb rejected
// artifact-sized payloads with an opaque error long before reaching a handler.
app.use(express.json({ limit: "10mb" }))

// Registered before requireInternal so the healthcheck stays reachable.
app.get("/",(req,res)=>{
    res.json({message:"Hello from Chat"});
})

app.use("/", requireInternal, router)

app.use((err,req,res,next)=>{
    console.error("[chat] unhandled error:",err)
    if (res.headersSent) {
        return next(err)
    }
    // body-parser sets both status and statusCode (e.g. 413 on an oversized body);
    // anything outside the HTTP range would make res.status() throw in here.
    const claimed=err?.status ?? err?.statusCode
    const status=Number.isInteger(claimed) && claimed>=400 && claimed<=599 ? claimed : 500
    return res.status(status).json({code:"internal_error",message:"Internal server error"})
})

const startServer = async () => {
    try {
        assertInternalSecret()
        await connectDb()
        app.listen(PORT,()=>{
            console.log(`Chat started at ${PORT}`);
        })
    } catch (error) {
        console.error(`server failed to start: ${error}`)
        process.exit(1)
    }
}

startServer()
