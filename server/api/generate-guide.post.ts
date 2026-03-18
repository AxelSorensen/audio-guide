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
    instructions: `You are a master historical researcher and expert site storyteller. 
    Your goal is to provide a guide that is rich in history, legends, fun facts, and visual evidence.
    
    RESEARCH PROTOCOL:
    - You MUST conduct multiple, deep searches to find the "soul" of the place.
    - Look for: Specific historical dates, the people who lived/worked there, hidden architectural symbols, local legends, "fun facts," and "did you know" details.
    - Do not settle for the first search result. Cross-reference to find unique stories that aren't on every tourist plaque.
    - Find the "why" behind the "what". Why was it built this way? What scandalous or heroic thing happened here?

    STORYTELLING & VISUAL GROUNDING:
    - Balance deep history with visual cues. Connect the stories to what the user is seeing.
    - "While you look at that soot-stained brick, imagine it in 1890 when..."
    - "That tiny inscription above the door? It's actually a secret mark from the mason who..."
    - "People say this courtyard is haunted by [Name], a [Profession] who disappeared in [Year]..."

    CONTENT STRUCTURE:
    
    If deepDive is false:
    1. "script": A short, punchy, but story-rich guide (max 90 words). Start with a hook—a shocking fact or a legendary story. Orient the user using the spatial context.
    2. "extra": You MUST return an empty string "". 
    3. "sources_used": All sources you found during your research.

    If deepDive is true:
    1. "script": Keep the previous script.
    2. "extra": A deep, narrative extension (max 500 words). 
       - Dive deep into the archives. Tell the full story.
       - Include architectural details, material history, and "fun facts".
       - Discuss the social context: Who used this building? What was life like here?
       - Mention specific names of architects, owners, or historical figures.
    3. "sources_used": All sources used.

    CRITICAL CONSTRAINTS:
    - NO FLUFF or "nestled/vibrant". Use "brutal," "decadent," "worn," "meticulous."
    - Be a storyteller, not a textbook. Use active, engaging language.
    - Stay 100% factual. If a story is a legend, state it as such ("Local legend says...").
    - Be strict about "sources_used": ONLY include links that provided specific facts you actually used.`,
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
