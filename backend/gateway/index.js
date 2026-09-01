import express from "express"
import dotenv from "dotenv"
import proxy from "express-http-proxy"
import cors from "cors"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import protect from "./middleware/auth.middleware.js"
import { getCurrentUser } from "./controllers/user.controller.js"
import { proxyWithHeader } from "./utils/proxyWithHeader.js"
import dns from "node:dns"
dns.setServers(["1.1.1.1", "8.8.8.8"])
dotenv.config()

const PORT = process.env.PORT

const app=express()
app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials:true
}))

app.use(morgan("dev"))
app.use(cookieParser())
app.use('/api/auth',proxy(process.env.AUTH_SERVICE, {
    limit: '50mb'
}))
app.use('/api/chat',protect,proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent",protect,proxyWithHeader(process.env.AGENT_SERVICE))
app.use("/api/billing",protect,proxyWithHeader(process.env.BILLING_SERVICE))
app.get("/api/me",protect,getCurrentUser)
app.get("/",(req,res)=>{
    res.json({message:"Hello from Gateway"});
})

app.listen(PORT,()=>{
    console.log(`gateway started at ${PORT}`);
})