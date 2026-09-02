import api from "../../utils/axios"

export const getConversations=async (signal) => {
    try {
        const {data}=await api.get("/api/chat/get-conversations", { signal })
        return data
    } catch (error) {
        if(error.name==='AbortError'||error.code==='ERR_CANCELLED'){
            return null
        }
        console.log(error)
        return []
    }
}