import api from "../../utils/axios"

export const verifyPayment=async (payload) => {
    try {
        const {data}=await api.post("/api/billing/verify",payload)
        return data
    } catch (error) {
        console.error("Failed to verify payment:", error)
        return { error: true, message: error?.response?.data?.message || "Failed to verify payment" }
    }
}