import axios from "axios"
import { internalHeaders } from "../../../shared/auth/internalAuth.js"

const REQUEST_TIMEOUT_MS = 10000

export const getMessages = async (conversationId, userId) => {
    const { data } = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`, {
        headers: internalHeaders(userId ? { "x-user-id": userId } : {}),
        timeout: REQUEST_TIMEOUT_MS
    })

    // Failures propagate instead of collapsing into []. Returning an empty array
    // here made "the chat service is down" indistinguishable from "this
    // conversation is new", and memory.js then cached that emptiness as truth.
    if (!Array.isArray(data)) {
        throw new Error(`chat service returned ${typeof data} instead of a message array`)
    }

    return data
}
