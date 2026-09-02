
import api from '../../utils/axios'

async function sendMessage(payload) {
 try {
    const {data}=await api.post("/api/agent/chat",payload)
    return data
 } catch (error) {
    console.error("Failed to send message:", error)
    return { error: true, message: error?.response?.data?.message || "Failed to send message" }
 }
}

export default sendMessage
