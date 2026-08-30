import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import dns from 'dns';
import router from "./routes/billing.route.js";
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config()

const port =process.env.PORT

const app=express()
app.use(express.json())
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"hello from billing"})
})

app.listen(port,()=>{
    console.log(`billing started at ${port}`)
    connectDb()
})
