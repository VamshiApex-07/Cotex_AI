import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"
import redis from "../../../shared/redis/redis.js"


export const agent=async (req,res,next) => {
    try {
        const {prompt,conversationId,agent}=req.body
        const file=req.file
        console.log("file",file)
        const userId=req.headers["x-user-id"]
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"user",content:prompt
        })
        const result=await graph.invoke({
            prompt,conversationId,agent,userId,file
        })
        console.log("result",result)
       await addMessage(conversationId,"user",prompt)
        const answer = result?.aiResponse != null
            ? result.aiResponse
            : "This agent isn't available yet. Try a different agent or switch it to Auto."
        const images = result?.images || []
        const artifacts = result?.artifacts || []
        await addMessage(conversationId,"assistant",answer)
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"assistant",content:answer,images,artifacts
        })
        return res.status(200).json({
            answer,
            images,
            artifacts
        })
       
    } catch (error) {
       console.error("=== AGENT CONTROLLER ERROR ===")
       console.error("Message:", error?.message)
       console.error("Name:", error?.name)
       console.error("Status:", error?.status)
       console.error("Data:", error?.data)
       console.error("Stack:", error?.stack)
       next(error)
    }
}