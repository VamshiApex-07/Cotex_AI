import { searchTool } from "../config/tavily.js"
import { slimSearchResults } from "../utils/slimSearchResults.js"
import { refundCredits, reserveCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
export const searchAgent = async (state) => {
    let reserved = false
    let reservation = null
    try {
        await checkAgentLimit(state.userId,"search")
        reservation = await reserveCredits(state.userId,"search")
        reserved = true
        const results = await searchTool.invoke({
            query: state.prompt
        })
        return {
            ...state,
            searchResults: slimSearchResults(results),
            images: results?.images || [],
            creditsPreReserved: true,
            preReservedAgent: "search",
            preReservationId: reservation?.reservationId
        }
    } catch (error) {
        // A swallowed search failure is still a failure the user must not pay for.
        if (reserved) await refundCredits(state.userId,"search",reservation?.reservationId)
        console.log(error)
        return {
            ...state,
            searchResults: [],
            images: [],
            searchFailed: true,
            aiResponse: error?.data?.message || "failed to search"
        }
    }
}