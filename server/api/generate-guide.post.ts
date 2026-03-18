import { Agent, run, tool } from '@openai/agents'
import { OpenAIProvider } from '@openai/agents-openai'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, vicinity, userLocation, placeLocation } = body

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

  const searchLogs: { query: string, links: { title: string, url: string }[] }[] = []

  // Define the Search Tool using the SDK's "tool" helper
  const webSearchTool = tool({
    name: 'webSearch',
    description: 'Search the web for specific historical facts, architectural details, and visual descriptions of a location.',
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
          max_results: 5
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
    instructions: `You are a direct, no-nonsense historical researcher. 
    Find the most interesting real fact about a place and tell it simply.
    
    CRITICAL CONSTRAINTS:
    - NO FANCY ADJECTIVES. Do not use "nestled," "vibrant," "intriguing," "testament to," or "stunning." 
    - NO MARKETING FLUFF. Just the facts.
    - BE SPECIFIC. Use exact years, specific names, and building materials.
    - START WITH THE HOOK. Put the most interesting fact in the first sentence.
    - MAXIMUM 80 WORDS. Keep it short.
    - Use British English and pointer directions from the spatial context.
    - Write ONLY spoken text.`,
    tools: [webSearchTool],
    model: await openaiProvider.getModel('gpt-4o')
  })

  try {
    const result = await run(tourGuideAgent, `Research and tell me about: ${name} in/near ${vicinity || 'unknown'}. ${spatialContext}`)
    const script = result.finalOutput

    if (!script) {
      throw new Error('Failed to generate script')
    }

    return {
      script,
      sources: searchLogs
    }

  } catch (error: any) {
    console.error('Error in agent execution:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
