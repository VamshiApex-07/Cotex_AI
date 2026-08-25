import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
dotenv.config()
import dns from 'dns';
import router from "./routes/auth,route.js";
dns.setServers(['8.8.8.8', '8.8.4.4']);
const PORT = process.env.PORT

const app=express()
app.use(express.json())
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"Hello from Auth"});
})

const startServer = async () => {
    try {
        await connectDb()
        app.listen(PORT,()=>{
            console.log(`Auth started at ${PORT}`);
        })
    } catch (error) {
        console.log(`server failed to start: ${error}`)
        process.exit(1)
    }
}

startServer()