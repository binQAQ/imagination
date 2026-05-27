import { buildImagePrompt, generateImage } from "../../lib/openai";

export async function POST(request) {
  try {
    const body = await request.json();
    const description = String(body.description || "").trim();
    const thoughts = Array.isArray(body.thoughts) ? body.thoughts.map(String) : [];

    if (!description) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }

    const imagePrompt = buildImagePrompt(description, thoughts);
    const { imageDataUrl, debug } = await generateImage(imagePrompt);

    return Response.json({
      imageDataUrl,
      debug: {
        imagePrompt,
        ...debug,
        imageDataUrlSummary: summarizeImageDataUrl(imageDataUrl),
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: "failed to generate image",
        detail: error.message,
      },
      { status: 500 },
    );
  }
}

function summarizeImageDataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  return {
    type: value.startsWith("data:image") ? "base64-data-url" : "url",
    length: value.length,
    preview: value.slice(0, 120),
  };
}
