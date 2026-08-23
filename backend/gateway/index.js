import express from "express"
import dotenv from "dotenv"
dotenv.config()

const PORT = process.env.PORT

const app=express()

app.get("/",(req,res)=>{
    res.json({message:"Hello from Gateway"});
})

app.listen(PORT,()=>{
    console.log(`gateway started at ${PORT}`);
})