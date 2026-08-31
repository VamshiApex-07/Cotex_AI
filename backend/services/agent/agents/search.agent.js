import { searchTool } from "../config/tavily.js"
import { slimSearchResults } from "../utils/slimSearchResults.js"
import { deductCredits } from "../utils/deductCredits.js"
export const searchAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId,"search")
        const results = await searchTool.invoke({
            query: state.prompt
        })
        await deductCredits(state.userId,"search")
        return {
            ...state,
            searchResults: slimSearchResults(results),
            images: results?.images || []
        }
    } catch (error) {
        console.log(error)
        return {
            ...state,
            searchResults: [],
            images: [],
            aiResponse: error?.data?.message || "failed to search"
        }
    }
}