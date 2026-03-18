import { Agent, run, tool, setDefaultModelProvider } from '@openai/agents'
import { OpenAIProvider } from '@openai/agents-openai'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, vicinity, userLocation, placeLocation, deepDive } = body

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
  setDefaultModelProvider(openaiProvider)

  const searchLogs: { query: string, links: { title: string, url: string }[] }[] = []

  // Define the output schema
  const TourGuideOutput = z.object({
    script: z.string().describe("A short, punchy guide script (max 80 words) focusing on visual grounding."),
    extra: z.string().describe("A deep, comprehensive extension (max 400 words) with new facts and architectural details."),
    sources_used: z.array(z.object({
      title: z.string(),
      url: z.string()
    })).describe("List of verified sources that were actually used to provide facts in the descriptions. DO NOT include sources that were searched but not used.")
  })

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
    instructions: `You are a direct, no-nonsense historical researcher and expert site guide. 
    Your goal is to provide a guide that feels like you are standing right next to the user, pointing at specific details they can see.

    RESEARCH PROTOCOL:
    - Even for a short script, you MUST conduct thorough research. Find multiple sources to verify architectural details, specific materials, and historical dates.
    - Use the search tool until you have a complete visual understanding of the building/site.
    - Look for obscure but true facts that a casual observer might miss.

    VISUAL GROUNDING:
    - Use search results to find specific architectural details (colors, materials, window shapes, statues, inscriptions).
    - Use phrases like "Notice the...", "Look up at the...", "If you look closely at the [material] walls...", "To your left, you'll see...".
    - Connect facts to visual evidence.

    CONTENT STRUCTURE:
    
    If deepDive is false:
    1. "script": A short, punchy guide (max 80 words). Start with the most striking visual feature or fact. Orient the user using the spatial context.
    2. "extra": You MUST return an empty string "". Do not generate detailed research yet.
    3. "sources_used": All sources you found during your thorough research.

    If deepDive is true:
    1. "script": Keep the previous short script.
    2. "extra": A deep, comprehensive extension (max 400 words). 
       - DO NOT REPEAT facts from the "script". 
       - Move into the "why" and "how". Discuss specific architects, historical turning points, or hidden symbols in the masonry.
       - Include legends or "inside stories" that aren't immediately obvious.
       - Continue the visual tour: "Beyond that archway...", "The interior, which was renovated in [Year], features...".
    3. "sources_used": All sources used for both the script and this deep dive.

    CRITICAL CONSTRAINTS:
    - NO FANCY ADJECTIVES like "nestled" or "vibrant". Use descriptive ones like "oxidised copper," "brutalist concrete," or "soot-stained brick."
    - Write ONLY spoken text.
    - Stay factual and evidence-based.
    - Be strict about "sources_used": ONLY include links that provided specific facts you actually incorporated into your internal model or the final output.`,
    tools: [webSearchTool],
    model: await openaiProvider.getModel('gpt-4o'),
    outputType: TourGuideOutput
  })

  try {
    const prompt = deepDive 
      ? `DRILL DOWN: Provide an exhaustive historical and architectural deep dive for ${name} in/near ${vicinity || 'unknown'}. Focus on specific evidence, dates, and technical details.`
      : `Research and tell me about: ${name} in/near ${vicinity || 'unknown'}. ${spatialContext}.`
    
    const result = await run(tourGuideAgent, prompt)
    const finalOutput = result.finalOutput

    if (!finalOutput) {
      throw new Error('Agent failed to produce structured output.')
    }

    const { script, extra, sources_used } = finalOutput

    return {
      script: script,
      extra: extra,
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
