import OpenAI from 'openai'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No audio data provided' })
  }

  const audioFile = formData.find(item => item.name === 'file')
  if (!audioFile || !audioFile.data) {
    throw createError({ statusCode: 400, statusMessage: 'Audio file is missing' })
  }

  const config = useRuntimeConfig()
  const openai = new OpenAI({ apiKey: config.openaiApiKey })

  try {
    // Whisper requires a real file or a specific File object
    // We'll create a File object from the buffer
    const file = new File([audioFile.data], 'recording.webm', { type: 'audio/webm' })

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    })

    return { text: response.text }
  } catch (error: any) {
    console.error('Transcription error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to transcribe audio'
    })
  }
})
