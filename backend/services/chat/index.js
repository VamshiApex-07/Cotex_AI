import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
dotenv.config()
import router from "./routes/chat.routes.js";
const PORT = process.env.PORT
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app=express()
app.use(express.json())
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"Hello from Chat"});
})

const startServer = async () => {
    try {
        await connectDb()
        app.listen(PORT,()=>{
            console.log(`Chat started at ${PORT}`);
        })
    } catch (error) {
        console.log(`server failed to start: ${error}`)
        process.exit(1)
    }
}

startServer()