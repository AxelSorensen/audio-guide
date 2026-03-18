export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { text } = body;

  if (!text) {
    throw createError({
      statusCode: 400,
      statusMessage: "Text is required",
    });
  }

  const config = useRuntimeConfig();
  const openaiApiKey = config.openaiApiKey;

  if (!openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "OpenAI API key is not configured",
    });
  }

  try {
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice: "fable",
        input: text,
      }),
    });

    if (!ttsResponse.ok) {
      const err = await ttsResponse.json();
      throw new Error(`TTS API error: ${err.error?.message || "Unknown"}`);
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString("base64");

    return {
      audioBase64: `data:audio/mp3;base64,${base64Audio}`,
    };
  } catch (error: any) {
    console.error("Error in TTS execution:", error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal Server Error",
    });
  }
});
