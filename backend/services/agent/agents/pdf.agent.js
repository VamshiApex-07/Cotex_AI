import { checkAgentLimit } from "../config/agentLimit.js"
import { getModel } from "../config/llmModels.js"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { generatePdf } from "../utils/generatePdf.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
export const pdfAgent=async (state) => {
    let reserved=false
    let reservation=null
    try {
        
        await checkAgentLimit(state.userId,"pdf")
        reservation=await reserveCredits(state.userId,"pdf")
        reserved=true
        const llm=await getModel("pdf")
        const prompt=`
        You are an expert document writer.

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return explanations.

Structure:

{
"title":"",
"subtitle":"",
"sections":[
{
"heading":"",
"points":[]
}
]
}

Generate 4-8 sections.

Each section should have 3-6 concise bullet points.

Topic:

${state.prompt}
        `

        const res=await llm.invoke(prompt)
        const data=JSON.parse(res.content)
        const pdfBuffer=await generatePdf(data)

        const filename=`pdf-${Date.now()}.pdf`
        await uploadToS3(filename,pdfBuffer,"application/pdf")

        const downloadUrl=await getFromS3(filename,24*60)

        return {
          ...state,
          aiResponse:`# PDF Generated

**${data.title}**

📥 [Download PDF](${downloadUrl})

_Link expires in 10 minutes._`
        }

    } catch (error) {
       // A swallowed failure is still a failure the user must not pay for.
       if(reserved) await refundCredits(state.userId,"pdf",reservation?.reservationId)
       console.log(error)
         return {
            ...state,
            aiResponse:error?.data?.message || "failed to generate pdf"
        }
    }
}