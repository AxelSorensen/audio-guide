import { Agent, run, tool, setDefaultModelProvider } from '@openai/agents'
import { OpenAIProvider } from '@openai/agents-openai'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, vicinity, userLocation, placeLocation, deepDive, researchData } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Place name is required',
    })
  }

  const config = useRuntimeConfig()
  const openaiApiKey = config.openaiApiKey
  const tavilyApiKey = process.env.NUXT_TAVILY_API_KEY

  if (!openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key is not configured',
    })
  }

  if (!tavilyApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Tavily API key is not configured in .env (NUXT_TAVILY_API_KEY)',
    })
  }

  const openaiProvider = new OpenAIProvider({ apiKey: openaiApiKey })
  // Silence tracing warning
  process.env.OPENAI_TRACING_API_KEY = process.env.OPENAI_TRACING_API_KEY || 'disabled'
  
  setDefaultModelProvider(openaiProvider)

  const searchLogs: { query: string, links: { title: string, url: string }[] }[] = []

  // Define the output schema
  const TourGuideOutput = z.object({
    script: z.string().describe("A short, punchy guide script (max 90 words)."),
    extra: z.string().describe("A deep, comprehensive extension (max 500 words)."),
    research_summary: z.string().describe("A massive, comprehensive dump of ALL historical facts, stories, architectural details, and fun facts found during research. Use this to pass information to the next run."),
    sources_used: z.array(z.object({
      title: z.string(),
      url: z.string()
    })).describe("List of verified sources that were actually used.")
  })

  // Define the Search Tool using the SDK's "tool" helper
  const webSearchTool = tool({
    name: 'webSearch',
    description: 'Search the web for specific historical facts, architectural details, and stories.',
    parameters: z.object({
      query: z.string().describe('The search query to look up facts about the location.'),
    }),
    execute: async ({ query }) => {
      console.log(`[Agent] Searching web for: ${query}`)
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: query,
          search_depth: 'advanced',
          max_results: 10
        })
      })
      const data = await response.json()
      
      const links = (data.results || []).map((r: any) => ({ title: r.title, url: r.url }))
      searchLogs.push({ query, links })
      
      return JSON.stringify(data.results)
    },
  })

  // Calculate relative direction
  let spatialContext = ""
  if (userLocation && placeLocation) {
    const dy = placeLocation.lat - userLocation.lat
    const dx = placeLocation.lng - userLocation.lng
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    
    let direction = ""
    if (angle > -22.5 && angle <= 22.5) direction = "to your East"
    else if (angle > 22.5 && angle <= 67.5) direction = "to your North-East"
    else if (angle > 67.5 && angle <= 112.5) direction = "to your North"
    else if (angle > 112.5 && angle <= 157.5) direction = "to your North-West"
    else if (angle > 157.5 || angle <= -157.5) direction = "to your West"
    else if (angle > -157.5 && angle <= -112.5) direction = "to your South-West"
    else if (angle > -112.5 && angle <= -67.5) direction = "to your South"
    else if (angle > -67.5 && angle <= -22.5) direction = "to your South-East"

    spatialContext = `The user is currently ${direction} from the location.`
  }

  // Create the Research & Guide Agent
  const tourGuideAgent = new Agent({
    name: 'HistoricalTourGuide',
    instructions: `You are a clinical historical researcher and expert site archivist. 
    Your goal is to provide a guide that is 100% concrete facts, specific details, and raw historical data. 

    ABSOLUTELY FORBIDDEN:
    - Vague, flowery AI marketing language: "echoes tales of...", "storied sanctuary", "timeless devotion", "testament to...", "step into a chapter", "whispers of the past", "vibrant", "nestled", "rich history".
    - Any sentence that doesn't contain a specific fact, name, date, or material.

    REQUIRED PROTOCOL:
    - Speak in RAW DATA and CONCRETE ANECDOTES.
    - If you find a story, tell the specific events: "In 1842, [Name] was arrested here for [Reason]" rather than "This place has seen many struggles."
    - Be surgical with architectural details: Mention "English bond brickwork," "Doric columns," "12-millimeter lead glazing," or "hand-carved limestone from [Quarry]."
    - Use numbers: Heights, weights, costs, dates, specific counts of windows/statues.

    RESEARCH PROTOCOL:
    - IF deepDive is false: You MUST conduct at least 4 deep searches to gather raw data. Look for the most obscure, specific facts possible.
    - IF deepDive is true: DO NOT SEARCH. Use only the provided 'researchData'.

    CONTENT STRUCTURE:
    
    If deepDive is false:
    1. "script": A dense, fact-packed guide (max 90 words). Start immediately with a specific date or name. No preamble.
    2. "extra": You MUST return an empty string "". 
    3. "research_summary": A massive, raw data dump of every single specific detail you found. 
    4. "sources_used": All sources used.

    If deepDive is true:
    1. "script": Keep the previous script.
    2. "extra": A deep, narrative extension (max 500 words). Focus on granular details: specific architects, ownership history, material origins, and documented historical events. 
    3. "research_summary": Pass back the existing researchData.
    4. "sources_used": All sources used.

    CRITICAL CONSTRAINTS:
    - Write like an encyclopedia entry mixed with a technical field report. 
    - If you can't find a specific fact, describe the physical material you found in search results.
    - NO ADJECTIVES unless they describe a physical property (e.g., "oxidized," "concave," "granite").`,
    tools: [webSearchTool],
    model: await openaiProvider.getModel('gpt-4o'),
    outputType: TourGuideOutput
  })

  try {
    const prompt = deepDive 
      ? `USE THIS RESEARCH TO WRITE A DEEP DIVE (DO NOT SEARCH): ${researchData}. \n\n Task: Provide an exhaustive narrative extension for ${name} in/near ${vicinity || 'unknown'}.`
      : `CONDUCT FULL RESEARCH AND WRITE SCRIPT: Research everything about ${name} in/near ${vicinity || 'unknown'}. ${spatialContext}. Search for history, stories, architectural details, and fun facts.`
    
    const result = await run(tourGuideAgent, prompt)
    const finalOutput = result.finalOutput

    if (!finalOutput) {
      throw new Error('Agent failed to produce structured output.')
    }

    const { script, extra, research_summary, sources_used } = finalOutput

    return {
      script: script,
      extra: extra,
      researchData: research_summary,
      sources: sources_used
    }

  } catch (error: any) {
    console.error('Error in agent execution:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
