import { InferenceClient } from "@huggingface/inference"
import { getModel } from "../config/llmModels.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
// Initialize HF Client using process.env.HF_TOKEN
const hf = new InferenceClient(process.env.HF_TOKEN)

export const visionAgent = async (state) => {
  let reserved = false
  let reservation = null
  try {
    await checkAgentLimit(state.userId,"image")
    reservation = await reserveCredits(state.userId,"vision")
    reserved = true
    const llm = await getModel("image")

    // 1. Refactored prompt engine: Action and main subject first
    const res = await llm.invoke(`
You are an expert AI image prompt engineer.

Expand the user request into a clear and vivid prompt for an image generator.

Rules:
- Place the core subject, action, and main props at the VERY BEGINNING.
- Keep description direct and natural (avoid tech-jargon like "85mm", "ISO 100", "8K").
- Focus on subject interaction, setting, and lighting.
- Return ONLY the final expanded prompt.

User Request: ${state.prompt}
    `)

    const prompt = res.content.trim()

    // 2. Call Hugging Face API using FLUX.1-schnell
    const imageBlob = await hf.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
    })
    // 3. Convert Blob to Node.js Buffer
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4. Upload file to S3
    const filename = `image-${Date.now()}.png`
    await uploadToS3(filename, buffer, "image/png")

    // 5. Get presigned S3 download URL (600 seconds = 10 minutes)
    const downloadUrl = await getFromS3(filename, 600)

    return {
      ...state,
      aiResponse: `
![Generated Image](${downloadUrl})

📥 [Download Image](${downloadUrl})

⏳ Link expires in 10 minutes.`
    }
  } catch (error) {
    // A swallowed failure is still a failure the user must not pay for.
    if (reserved) await refundCredits(state.userId,"vision",reservation?.reservationId)
    console.error("HF Vision Agent Error:", error)
    return {
      ...state,
      aiResponse: error?.message || "Failed to generate image via Hugging Face."
    }
  }
}