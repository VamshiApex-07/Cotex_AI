import express from "express"
import { requireUser } from "../../../shared/auth/internalAuth.js"
import { createConversation, deleteConversation, getConversations, getMessages, saveMessage, updateConversation } from "../controllers/chat.controller.js"

const router=express.Router()

// Identity is established once, before any handler runs: Mongoose strips
// undefined out of query filters, so a missing x-user-id would otherwise turn
// every owner-scoped query into an unscoped one.
router.use(requireUser)

router.post("/create-conversation",createConversation)
router.get("/get-conversations",getConversations)
router.post("/update-conversation",updateConversation)
router.post("/save-message",saveMessage)
router.get("/get-messages/:conversationId",getMessages)
router.post("/delete-conversation",deleteConversation)
export default router
