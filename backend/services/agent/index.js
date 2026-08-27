import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
dotenv.config()
import dns from 'dns';
const port =process.env.PORT
dns.setServers(['8.8.8.8', '8.8.4.4']);
const app=express()

app.use(express.json())

app.use((err,req,res,next)=>{
  console.log(err)

  if(err.status){
    return res.status(err.status).json(err.data)
  }

  return res.status(500).json({message:`agent error ${error}`})
})


app.get("/",(req,res)=>{
    res.json({message:"hello from agent"})
})

app.listen(port,()=>{
    console.log(`agent started at ${port}`)
    connectDb()
})
