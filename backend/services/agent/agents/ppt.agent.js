import { checkAgentLimit } from "../config/agentLimit.js"
import { getModel } from "../config/llmModels.js"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { generatePpt } from "../utils/generatePpt.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"

export const pptAgent = async (state) => {
  let reserved = false
  let reservation = null
  try {
    await checkAgentLimit(state.userId,"ppt")
    reservation = await reserveCredits(state.userId,"ppt")
    reserved = true
    const llm = await getModel("ppt")
    const prompt = `You are a professional presentation designer and visual content curator.

Return ONLY a valid raw JSON object (no markdown backticks, no code block wrappers, no pre/post explanations).

JSON Structure:
{
  "title": "Main Presentation Title",
  "subtitle": "A compelling, concise subtitle",
  "slides": [
    {
      "title": "Slide Title",
      "points": [
        "Concise, impactful key takeaway point 1",
        "Concise, impactful key takeaway point 2",
        "Concise, impactful key takeaway point 3",
        "Concise, impactful key takeaway point 4"
      ],
      "imagePrompt": "A modern, high-tech minimalist illustration depicting the slide topic"
    }
  ]
}

Rules:
- Generate exactly 6 content slides.
- Each slide must have 3 to 5 concise points.
- Provide a clear, relevant 'imagePrompt' for each slide.
- Return ONLY valid JSON.

Topic: ${state.prompt}`

    const res = await llm.invoke(prompt)
    
    // Clean potential markdown backticks from LLM output
    let cleanJson = res.content.trim()
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const data = JSON.parse(cleanJson)
    const ppt = await generatePpt(data)
    
    const buffer = await ppt.write({
      outputType: "nodebuffer"
    })

    const filename = `ppt-${Date.now()}.pptx`
    await uploadToS3(filename, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation")
    
    // Set 600s (10 minutes) expiration to match the UI notice
    const downloadUrl = await getFromS3(filename, 600)

    return {
      ...state,
      aiResponse: `# ✅ Presentation Generated

**${data.title}**

📥 [Download PPT (.pptx)](${downloadUrl})

_Link expires in 10 minutes._`
    }

  } catch (error) {
    // A swallowed failure is still a failure the user must not pay for.
    if (reserved) await refundCredits(state.userId,"ppt",reservation?.reservationId)
    console.error("PPT Agent Error:", error)
    return {
      ...state,
      aiResponse: error?.message || "Failed to generate PPT presentation."
    }
  }
}