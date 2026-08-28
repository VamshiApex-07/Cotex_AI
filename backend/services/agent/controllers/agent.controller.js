import axios from "axios"
import { graph } from "../graph/graph.js"


export const agent=async (req,res,next) => {
    try {
        const userId=req.headers["x-user-id"]
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"user",content:prompt
        })
        const result=await graph.invoke({
            prompt,conversationId,agent,userId,file
        })
        console.log("result",result)
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"assistant",content:result?.aiResponse,images:result?.images,artifacts:result?.artifacts
        })
        return res.status(200).json({
            answer:result?.aiResponse,
            images:result?.images,
            artifacts:result?.artifacts
        })
       
    } catch (error) {
       next(error)
    }
}