import { generateGuideResponse } from "../../lib/openai";

const MAX_ROUNDS = 5;

export async function POST(request) {
  try {
    const body = await request.json();
    const latestAnswer = String(body.latestAnswer || "").trim();
    const round = Number(body.round || 1);
    const history = Array.isArray(body.history)
      ? body.history.map((turn) => ({
          question: String(turn.question || ""),
          answer: String(turn.answer || ""),
        }))
      : [];

    if (!latestAnswer) {
      return Response.json({ error: "latestAnswer is required" }, { status: 400 });
    }

    const guide = await generateGuideResponse({
      history,
      latestAnswer,
      round,
      maxRounds: MAX_ROUNDS,
    });

    return Response.json({
      done: Boolean(guide.done || round >= MAX_ROUNDS),
      speech: String(guide.speech || ""),
      prefix: String(guide.prefix || ""),
      suggestion: String(guide.suggestion || ""),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: "failed to generate dialogue",
        detail: error.message,
      },
      { status: 500 },
    );
  }
}
