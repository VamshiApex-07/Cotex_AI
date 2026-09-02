import api from "../../utils/axios"

export const createOrder=async (plan) => {
    try {
        const {data}=await api.post("/api/billing/create",{plan})
        return data
    } catch (error) {
        console.error("Failed to create order:", error)
        return { error: true, message: error?.response?.data?.message || "Failed to create order" }
    }
}