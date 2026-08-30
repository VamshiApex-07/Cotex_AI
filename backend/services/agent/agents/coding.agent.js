import { getModel } from "../config/llmModels.js"
import { deductCredits } from "../utils/deductCredits.js"
export const codingAgent=async (state) => {
try {
   const intentLlm=await getModel("intent")
   const llm=await getModel("coding")
   const intentRes=await intentLlm.invoke(`
    You are an intent classifier.

Return ONLY one of these values.

PROJECT_GENERATION
PROGRAM_GENERATION
CODE_REVIEW
CODE_EXPLANATION
DEBUGGING
OPTIMIZATION
CONVERSION
DOCUMENTATION

Rule: 
- Use PROJECT_GENERATION for web apps, UIs, interactive web pages, or explicit "project" requests.
- Use PROGRAM_GENERATION for basic algorithmic problems, simple logic, or "write a program" requests.

User Request:
${state.prompt}
    `)
    const intent=(Array.isArray(intentRes.content)
        ? intentRes.content.map(part=>typeof part==="string"?part:part?.text||"").join("")
        : String(intentRes.content||"")).trim().toUpperCase()
    if(intent.includes("PROGRAM_GENERATION")){
        const res=await llm.invoke(`
        You are CortexAI Coding Agent.
        
        The user wants a basic program, algorithmic solution, or simple logic.
        
        Rules:
        - Output the code block directly in the chat response using Markdown.
        - Default Language: Use C++ unless the user explicitly specifies another language (like Python, Java, etc.).
        - Do NOT generate HTML, CSS, JavaScript, or web artifacts for these basic program requests.
        - Provide a brief explanation of the code.
        
        User Request:
        ${state.prompt}
        `)
        
        return {
            ...state,
            aiResponse: res.content,
            artifacts: []
        }
    }

    if(intent.includes("PROJECT_GENERATION") || intent.includes("CODE_GENERATION")){
        const prompt=`
        You are CortexAI Coding Agent.

Generate the requested project.

Default stack:
- HTML
- CSS
- JavaScript

Use React / Next.js / Vue ONLY if explicitly requested.

Rules:

- Responsive
- Modern UI
- CSS Variables
- Flexbox/Grid
- Smooth Scroll
- Hover Effects
- Beautiful spacing
- Single page unless user asks otherwise.

IMAGES
=========================

CRITICAL: DO NOT use Unsplash URLs (images.unsplash.com or source.unsplash.com) as they will 404 or block iframes.
Instead, strictly use: https://image.pollinations.ai/prompt/{description}
Replace {description} with a detailed, URL-encoded description of the image (e.g., https://image.pollinations.ai/prompt/beautiful%20santorini%20greece%20sunset).
This ensures 100% reliable rendering inside the preview/sandbox iframe.

Return ONLY valid JSON.

Schema:

{
  "files":[
    {
      "name":"index.html",
      "content":"..."
    },
    {
      "name":"style.css",
      "content":"..."
    },
    {
      "name":"script.js",
      "content":"..."
    }
  ]
}

Rules:

- Output must start with {
- Output must end with }
- No markdown
- No explanation
- No extra text
- No \`\`\`
- Never mention intent

User Request:
${state.prompt}
        ` 
        const res=await llm.invoke(prompt)
        console.log(res)
        const raw=String(res.content).trim()
        const start=raw.indexOf("{")
        const end=raw.lastIndexOf("}")
        const data=JSON.parse(start!==-1 && end>start ? raw.slice(start,end+1) : raw)
        await deductCredits(state.userId,"coding")
        return {
            ...state,
            aiResponse:"Project Generated Successfully.",
            artifacts:[
                {
                    id:Date.now(),
                    type:"Project",
                    files:data.files || [],
                    title:state.prompt
                }
            ]
        }
    }

    const res=await llm.invoke(`
        The user's request is:

${intent}

Return Markdown only.

Never generate project files.

Use headings like:

# Overview

## Explanation

## Problems

## Improvements

## Best Practices

## Optimized Code (if needed)

User Request:

${state.prompt}
        `)

   const data=res.content   
   await deductCredits(state.userId,"coding")
   return {
    ...state,
    aiResponse:data,
    artifacts:[]
   }  
} catch (error) {
   console.log(error)
         return {
            ...state,
            aiResponse:error?.data?.message || "failed to generate code",
            artifacts:[]
        }
}
  
}