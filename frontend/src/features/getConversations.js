import api from "../../utils/axios"

export const getConversations=async ({ page = 1, limit = 15, search = "", signal } = {}) => {
    try {
        const params = new URLSearchParams()
        params.set("page", String(page))
        params.set("limit", String(limit))
        if (search.trim()) {
            params.set("search", search.trim())
        }
        const { data } = await api.get(`/api/chat/get-conversations?${params.toString()}`, { signal })
        return data
    } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELLED') {
            return null
        }
        console.log(error)
        return null
    }
}