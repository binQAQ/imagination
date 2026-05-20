export async function GET() {
  return Response.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    textModel: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
}
