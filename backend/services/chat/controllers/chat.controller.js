import mongoose from "mongoose"
import Conversation from "../models/conversation.model.js"
import Message from "../models/message.model.js"

const OBJECT_ID=/^[0-9a-fA-F]{24}$/

// isValidObjectId() accepts any 12-character string and anything Mongoose can
// cast, so a JSON body value like {"$ne":null} slips past it and then matches
// arbitrary documents. Pinning the input to 24 hex chars closes that off before
// the value ever reaches a query filter.
const isObjectId=(value)=>typeof value==="string" && OBJECT_ID.test(value) && mongoose.isValidObjectId(value)

const TITLE_MAX=200
const MESSAGE_LIMIT_DEFAULT=50
const MESSAGE_LIMIT_MAX=100
const CONVERSATION_LIMIT=200

const parseLimit=(raw)=>{
    if (typeof raw!=="string") return MESSAGE_LIMIT_DEFAULT
    const parsed=Number.parseInt(raw,10)
    if (Number.isNaN(parsed)) return MESSAGE_LIMIT_DEFAULT
    return Math.min(Math.max(parsed,1),MESSAGE_LIMIT_MAX)
}

const fail=(res,status,code,message)=>res.status(status).json({code,message})

export const createConversation=async (req,res) => {
  try {
    const conversation=await Conversation.create({
        userId:req.userId
    })

    return res.status(200).json(conversation)
  } catch (error) {
     console.error("[chat] create conversation failed:",error)
     return fail(res,500,"create_conversation_failed","Could not create conversation")
  }
}

export const getConversations=async (req,res) => {
  try {
    const conversations=await Conversation.find({
        userId:req.userId
    }).sort({updatedAt:-1}).limit(CONVERSATION_LIMIT).lean()

    return res.status(200).json(conversations)
  } catch (error) {
     console.error("[chat] get conversations failed:",error)
     return fail(res,500,"get_conversations_failed","Could not load conversations")
  }
}

export const updateConversation=async (req,res) => {
  try {
    const {id,title}=req.body
    if (!isObjectId(id)) {
        return fail(res,400,"invalid_conversation_id","Invalid conversation id")
    }
    if (typeof title!=="string") {
        return fail(res,400,"invalid_title","Invalid title")
    }
    // The client titles a new chat with the whole first prompt, which routinely
    // exceeds TITLE_MAX; clamping keeps that flow working instead of turning it
    // into a validation error.
    const nextTitle=title.trim().slice(0,TITLE_MAX)
    if (!nextTitle) {
        return fail(res,400,"invalid_title","Invalid title")
    }

    // One atomic owner-scoped write: the previous read-then-write both raced and
    // updated by _id alone, so any authenticated user could rename any chat.
    const updated=await Conversation.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { $set: { title: nextTitle } },
        { new: true, runValidators: true }
    )
    if (!updated) {
        return fail(res,404,"conversation_not_found","Conversation not found")
    }

    return res.status(200).json(updated)
  } catch (error) {
     console.error("[chat] update conversation failed:",error)
     return fail(res,500,"update_conversation_failed","Could not update conversation")
  }
}

export const saveMessage=async (req,res) => {
    try {
        const {conversationId,role,content,images,artifacts}=req.body
        if (!isObjectId(conversationId)) {
            return fail(res,400,"invalid_conversation_id","Invalid conversation id")
        }

        // The gate only has to prove the row exists for this owner, so don't
        // hydrate a full document to throw it away.
        const owned=await Conversation.findOne({ _id: conversationId, userId: req.userId }).select("_id").lean()
        if (!owned) {
            return fail(res,404,"conversation_not_found","Conversation not found")
        }

        const message=await Message.create({
            conversationId,
            userId:req.userId,
            content,
            role,
            images,
            artifacts
        })
        return res.status(200).json(message)
    } catch (error) {
        if (error?.name==="ValidationError" || error?.name==="CastError") {
            console.error("[chat] save message rejected:",error)
            return fail(res,400,"invalid_message","Invalid message payload")
        }
        console.error("[chat] save message failed:",error)
        return fail(res,500,"save_message_failed","Could not save message")
    }
}

export const getMessages=async (req,res) => {
    try {
        const conversationId=req.params.conversationId
        if (!isObjectId(conversationId)) {
            return fail(res,400,"invalid_conversation_id","Invalid conversation id")
        }

        const owned=await Conversation.findOne({ _id: conversationId, userId: req.userId }).select("_id").lean()
        if (!owned) {
            return fail(res,404,"conversation_not_found","Conversation not found")
        }

        // Filtered on conversationId alone (not userId) because the parent
        // ownership check above already authorised it and messages written before
        // Message.userId existed have no value to match against.
        const messages=await Message.find({ conversationId })
            .sort({createdAt:-1})
            .limit(parseLimit(req.query.limit))
            .lean()

        // Newest N were taken for the limit; the client renders top-to-bottom, so
        // hand it back chronologically.
        return res.status(200).json(messages.reverse())
    } catch (error) {
        console.error("[chat] get messages failed:",error)
        return fail(res,500,"get_messages_failed","Could not load messages")
    }
}
