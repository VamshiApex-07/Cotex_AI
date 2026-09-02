import api from "../../utils/axios.js"

async function getMessages(id, signal){
    try{
        const {data}=await api.get(`/api/chat/get-messages/${id}`, { signal })
        return data
    }
    catch(error){
        if(error.name==='AbortError'||error.code==='ERR_CANCELLED'){
            return null
        }
        console.log(error)
        return []
    }
}

export default getMessages