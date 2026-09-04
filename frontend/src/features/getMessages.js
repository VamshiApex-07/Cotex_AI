import api from "../../utils/axios.js"

async function getMessages({ id, before, limit = 15, signal }) {
    try {
        const params = new URLSearchParams()
        if (before) params.set("before", before)
        if (limit !== 50) params.set("limit", limit)
        const queryString = params.toString()
        const url = `/api/chat/get-messages/${id}${queryString ? `?${queryString}` : ""}`
        const { data } = await api.get(url, { signal })
        return data
    }
    catch(error){
        if(error.name==='AbortError'||error.code==='ERR_CANCELLED'){
            return null
        }
        console.log(error)
        return null
    }
}

export default getMessages