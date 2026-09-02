import path from "node:path"
import fs from "node:fs/promises"
import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"
import { internalHeaders } from "../../../shared/auth/internalAuth.js"

const OBJECT_ID = /^[0-9a-fA-F]{24}$/
const CHAT_SERVICE_TIMEOUT_MS = 15000
const UPLOAD_DIR = path.resolve(import.meta.dirname, "../temp")

// pdfRag and imageAnalyzer unlink the upload themselves once they are done with
// it, so ENOENT here is the expected double-unlink, not a fault. The prefix check
// bounds the delete to the upload directory: multer names files with a UUID now,
// but an unlink driven by request-influenced state should not be able to address
// anything outside it.
const removeUpload = async (filePath) => {
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(`${UPLOAD_DIR}${path.sep}`)) {
        console.error("[agent] refusing to unlink outside the upload dir:", resolved)
        return
    }

    try {
        await fs.unlink(resolved)
    } catch (error) {
        if (error?.code !== "ENOENT") {
            console.error("[agent] could not remove upload:", error?.message)
        }
    }
}

const saveMessage = (userId, message) => axios.post(
    `${process.env.CHAT_SERVICE}/save-message`,
    message,
    {
        headers: internalHeaders({ "x-user-id": userId }),
        timeout: CHAT_SERVICE_TIMEOUT_MS
    }
)

export const agent=async (req,res,next) => {
    try {
        const {prompt,conversationId,agent}=req.body
        const file=req.file
        const userId=req.userId

        if (typeof conversationId !== "string" || !OBJECT_ID.test(conversationId)) {
            return res.status(400).json({ code: "invalid_conversation_id", message: "Invalid conversation id" })
        }
        // An empty prompt is legitimate when a file is attached: the router picks
        // the agent from the mimetype and imageAnalyzer substitutes "analyze the
        // image", so only a promptless request with no file is rejected.
        if (typeof prompt !== "string" || (!file && prompt.trim().length === 0)) {
            return res.status(400).json({ code: "invalid_prompt", message: "A prompt is required." })
        }

        // Both stores get the turn before the graph runs. Writing to the chat
        // service first and to Redis only afterwards meant a throw out of
        // graph.invoke left the message in Mongo and missing from the cached
        // window, and the cache outlives that failure by a full TTL. Chat service
        // first in both pairs, because it is what getMemory rebuilds from — so a
        // failed Redis write self-heals, while a failed Mongo write stops the turn
        // before Redis can diverge from it.
        await saveMessage(userId, { conversationId, role: "user", content: prompt })
        await addMessage(conversationId,"user",prompt)

        const result=await graph.invoke({
            prompt,conversationId,agent,userId,file
        })
        const answer = result?.aiResponse != null
            ? result.aiResponse
            : "This agent isn't available yet. Try a different agent or switch it to Auto."
        const images = result?.images || []
        const artifacts = result?.artifacts || []
        await saveMessage(userId, { conversationId, role: "assistant", content: answer, images, artifacts })
        await addMessage(conversationId,"assistant",answer)
        return res.status(200).json({
            answer,
            images,
            artifacts,
            agent: result?.agent || "chat"
        })

    } catch (error) {
       console.error("=== AGENT CONTROLLER ERROR ===")
       console.error("Message:", error?.message)
       console.error("Name:", error?.name)
       console.error("Status:", error?.status)
       console.error("Data:", error?.data)
       console.error("Stack:", error?.stack)
       next(error)
    } finally {
        // multer has already written the upload to disk by the time this handler
        // runs, so an early 400 leaks it just as surely as a crash does — hence
        // finally, which also covers the success path.
        if (req.file?.path) {
            await removeUpload(req.file.path)
        }
    }
}
