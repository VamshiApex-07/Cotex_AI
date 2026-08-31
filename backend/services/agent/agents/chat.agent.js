import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"
import { deductCredits } from "../utils/deductCredits.js"
import {checkAgentLimit} from "../config/agentLimit.js"
const MAX_INPUT_CHARS = 14000
const MAX_MESSAGE_CHARS = 2500

const fitWithinBudget = (messages) => {
    let total = messages.reduce((sum, m) => sum + String(m.content).length, 0)
    if (total <= MAX_INPUT_CHARS) return messages

    while (total > MAX_INPUT_CHARS && messages.length > 2) {
        const removed = messages.splice(1, 1)[0]
        total -= String(removed.content).length
    }

    if (total <= MAX_INPUT_CHARS) return messages

    return messages.map((m) => {
        const content = String(m.content)
        if (content.length <= MAX_MESSAGE_CHARS) return m
        return new m.constructor(content.slice(0, MAX_MESSAGE_CHARS) + "\n...[truncated]")
    })
}

export const chatAgent = async (state) => {

   

    try {
        await checkAgentLimit(state.userId,"chat")
         const llm = await getModel("chat")

    const history = await getMemory(state.conversationId)
    const recentHistory = (history || []).slice(-8)

   const searchContext=state.searchResults?`
   Web Search Results:

${JSON.stringify(state.searchResults)}

Answer the user using only the above search results.
`:""


    const systemPrompt = `
    You are CortexAI, an intelligent AI assistant.

 
    ${searchContext}

    If searchContext exists:

- Use search results to answer.
- Do not mention internal tools.


    Rules:

- For simple questions, greetings, and short queries, respond naturally in plain text.
- For technical, educational, coding, or detailed topics, use clean Markdown.


 Formatting:

- Use # for titles and ## for sections.
- Leave a blank line after headings.
- Use bullet points for lists.
- Use numbered lists for steps.
- Use fenced code blocks with language tags for code.
- Keep paragraphs short and readable.
- Never write headings and content on the same line.
- Never generate large walls of text.
`
    const messages = [
        new SystemMessage(systemPrompt)
    ]

    recentHistory.forEach(msg => {
        if (!msg || msg.content == null) return
        if (msg.role == "user") {
            messages.push(new HumanMessage(msg.content))
        } else if (msg.role == "assistant") {
            messages.push(new AIMessage(msg.content))
        }
    });

    messages.push(new HumanMessage(state.prompt))





    const boundedMessages = fitWithinBudget(messages)

    const response = await llm.invoke(boundedMessages)
    await deductCredits(state.userId,"chat")
    return {
        ...state,
        aiResponse: response.content,
        
    }
    } catch (error) {
        console.log(error)
         return {
            ...state,
            aiResponse:error?.data?.message || "failed to generate chat"
        }
        
    
    }
   
}