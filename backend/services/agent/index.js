import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/agent.route.js"
dotenv.config()
const port =process.env.PORT

const app=express()

app.use(express.json())
app.use("/",router)
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
app.use((err,req,res,next)=>{
  console.error("=== AGENT ERROR MIDDLEWARE ===")
  console.error("Message:", err?.message)
  console.error("Name:", err?.name)
  console.error("Stack:", err?.stack)
  if(err.status){
    return res.status(err.status).json(err.data)
  }

  return res.status(500).json({message:`agent error ${err}`})
})


app.get("/",(req,res)=>{
    res.json({message:"hello from agent"})
})

app.listen(port,()=>{
    console.log(`agent started at ${port}`)
    connectDb()
})
