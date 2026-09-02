
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import fs from "fs/promises"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
export const imageAnalyzer =async (state) => {
     let reserved = false
     let reservation = null
     try {
     await checkAgentLimit(state.userId,"vision")
     reservation = await reserveCredits(state.userId,"vision")
     reserved = true
        const llm = await getModel("imageAnalyzer")

        const imageBuffer = await fs.readFile(state.file.path)
        const base64Image = imageBuffer.toString("base64")

        const messages = [
            new SystemMessage(
                `You are CortexAI image analyzer Agent.

Rules:

- Analyze only the uploaded image.
- Answer the user's question accurately.
- If text exists in the image, extract it.
- If charts or tables exist, explain them.
- If something is unclear, say so.
- Use Markdown when helpful.
- Do not hallucinate.
`
            ),
            new HumanMessage(
                {
                    content: [
                        {
                            type: "text",
                            text: state.prompt || "analyze the image"
                        },
                        {
                            type:"image_url",
                            "image_url":{
                                url:`data:${state.file.mimetype};base64,${base64Image}`
                            }
                        }
                    ]
                }

            )
        ]

const response=await llm.invoke(messages)
return {
    ...state,
    aiResponse:response.content
}

    } catch (error) {
       // The reservation is taken before this try block, so reaching here always
       // means it succeeded -- no guard needed. A swallowed failure is still a
       // failure the user must not pay for.
       await refundCredits(state.userId,"vision",reservation?.reservationId)
       console.log(error)
         return {
            ...state,
            aiResponse:error?.data?.message || "failed to analyze image"
        
}
    }
    finally{
      await fs.unlink(state.file.path)
    }
}