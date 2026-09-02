import fs from "fs"
import { PDFParse } from "pdf-parse"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { Document } from "@langchain/core/documents"
import { vectorStore } from "../config/vectorDb.js"
import { getModel } from "../config/llmModels.js"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"

const SCANNED_TEXT_THRESHOLD = 150
const MAX_VISION_PAGES = 10 // Cap to prevent gateway timeouts

/**
 * Vision LLM OCR: Extracts page screenshots via PDFParse (bundled pdfjs renderer)
 * and sends base64 images directly to Gemini Vision for Markdown layout recovery.
 */
const visionOCR = async (buffer) => {
  const pdf = new PDFParse({ data: buffer })
  const screenshotResult = await pdf.getScreenshot({ scale: 2.0 })
  const pages = screenshotResult?.pages || []

  const visionLlm = await getModel("vision-ocr")
  const pagePromises = []

  const pagesToProcess = pages.slice(0, MAX_VISION_PAGES)

  for (const page of pagesToProcess) {
    const base64Png = Buffer.from(page.data).toString("base64")

    pagePromises.push(
      visionLlm.invoke([
        new SystemMessage(
          "Extract all text, numbers, and layout elements from this document page into clean, structured Markdown. " +
          "Represent any tables using standard Markdown table syntax (| Header | Header |). " +
          "Do not summarize, output only the exact document content."
        ),
        new HumanMessage({
          content: [
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Png}` } }
          ]
        })
      ]).then((res) => res.content)
    )
  }

  const results = await Promise.all(pagePromises)
  return results.join("\n\n")
}

export const pdfRag = async (state) => {
  let collectionName = null
  let reserved = false
  let reservation = null
  try {
    await checkAgentLimit(state.userId, "pdf")
    reservation = await reserveCredits(state.userId, "pdf")
    reserved = true
    console.log("[PDFRAG] Starting pipeline for file:", state.file.path)

    const buffer = fs.readFileSync(state.file.path)

    // Stage 1: Fast digital extraction attempt using PDFParse
    const pdf = new PDFParse({ data: buffer })
    const textResult = await pdf.getText()
    const text = textResult?.text || ""
    console.log("[PDFRAG] PDF text extracted. Length:", text.length)

    const isScanned = text.length < SCANNED_TEXT_THRESHOLD

    // Stage 2: Fallback to Gemini Vision OCR if digital text is empty/scanned
    const finalText = isScanned
      ? await visionOCR(buffer)
      : text

    console.log("[PDFRAG] Final text length (after OCR check):", finalText.length)

    // Stage 3: Adaptive Chunking (Preserve entire doc if under 2500 chars to keep tables intact)
    let docs
    if (finalText.length < 2500) {
      console.log("[PDFRAG] Small doc detected (< 2500 chars). Using single chunk.")
      docs = [new Document({ pageContent: finalText })]
    } else {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
        separators: ["\n# ", "\n## ", "\n", " "]
      })
      docs = await splitter.createDocuments([finalText])
    }

    collectionName = `pdf-${Date.now()}`
    const store = await vectorStore(docs, collectionName)

    let context = ""
    const isSummaryRequest = /(summarize|summary|overview)/i.test(state.prompt)

    if (isSummaryRequest) {
      context = finalText.slice(0, 40000)
    } else {
      const relevantDocs = await store.similaritySearch(state.prompt, 10)
      context = relevantDocs.map((d) => d.pageContent).join("\n\n")
    }

    const llm = await getModel("pdf-rag")
    const messages = [
      new SystemMessage(`You are CortexAI PDF Assistant.

Rules:
- Answer ONLY from the uploaded PDF.
- Never make up information.
- If the answer is not present in the PDF, reply: "I couldn't find this information in the uploaded PDF."
- Use Markdown formatting.`),

      new HumanMessage(`Context:${context}\n\nQuestion:${state.prompt}`)
    ]

    const response = await llm.invoke(messages)

    return {
      ...state,
      aiResponse: response.content
    }

  } catch (error) {
    // A swallowed failure is still a failure the user must not pay for.
    if (reserved) await refundCredits(state.userId, "pdf", reservation?.reservationId)
    console.error("[PDFRAG] Error:", error)
    return {
      ...state,
      aiResponse: error?.data?.message || "Failed to analyze PDF."
    }
  } finally {
    try {
      if (state.file?.path && fs.existsSync(state.file.path)) {
        await fs.promises.unlink(state.file.path)
      }
    } catch (cleanupError) {
      console.error("[PDFRAG] Cleanup error:", cleanupError)
    }
  }
}