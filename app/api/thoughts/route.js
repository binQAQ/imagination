import { generateThoughts } from "../../lib/openai";

export async function POST(request) {
  try {
    const body = await request.json();
    const description = String(body.description || "").trim();

    if (!description) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }

    const thoughts = await generateThoughts(description);
    return Response.json({ thoughts });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: "failed to generate thoughts",
        detail: error.message,
      },
      { status: 500 },
    );
  }
}
