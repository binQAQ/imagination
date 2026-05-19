const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export async function generateThoughts(description) {
  assertApiKey();

  const prompt = `
你正在扮演一位盲人美术馆观众。
玩家正在向你描述米勒《拾穗者》。

请根据玩家的描述，生成你在想象画面时说出的短句。

规则：
- 输出 JSON，格式为 {"thoughts":["..."]}。
- 只输出 JSON，不要 markdown。
- 5 到 8 句。
- 每句 15 到 35 个汉字。
- 第一人称。
- 具体但克制。
- 包含空间、触感、色彩、人物动作、情绪。
- 不要评价玩家。
- 不要提到 AI、提示词、生成图片。

玩家描述：
${description}
`;

  const data = await callOpenAI({
    model: TEXT_MODEL,
    input: prompt,
    reasoning: {
      effort: "low",
    },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "blind_visitor_thoughts",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            thoughts: {
              type: "array",
              minItems: 5,
              maxItems: 8,
              items: {
                type: "string",
              },
            },
          },
          required: ["thoughts"],
        },
      },
    },
  });

  const text = extractOutputText(data);
  const parsed = JSON.parse(text);
  return parsed.thoughts;
}

export async function generateImage(prompt) {
  assertApiKey();

  const data = await callOpenAI({
    model: TEXT_MODEL,
    input: prompt,
    tool_choice: {
      type: "image_generation",
    },
    tools: [
      {
        type: "image_generation",
        model: IMAGE_MODEL,
        size: "1536x1024",
      },
    ],
  });

  const imageCall = data.output?.find((item) => item.type === "image_generation_call");
  const imageBase64 = imageCall?.result;

  if (!imageBase64) {
    throw new Error("No generated image returned from OpenAI");
  }

  return imageBase64;
}

export function buildImagePrompt(description, thoughts) {
  return `
Create the blind museum visitor's imagined painting based only on the player's description and the visitor's inner thoughts.
This should not be an exact copy of Jean-Francois Millet's The Gleaners. It should be an imagined reinterpretation with visible uncertainty and omissions.

Player description:
${description}

Blind visitor thoughts:
${thoughts.join("\n")}

Visual style:
Abstract oil painting style, cubist construction, geometric fragmented structure, non-realistic proportions, flattened spatial treatment, irregular color-block collage, mixed front and side views, asymmetrical composition. Heavy dark contour lines with slight hand-drawn tremble. Low to medium saturation vintage palette: teal green, gray blue, dark purple, ochre yellow, orange red, deep brown, black, warm off-white. Thick impasto oil paint, rough canvas texture, visible brush direction, dry-brush scraping, mottled pigment, overpainted patches, hand-painted traces.

Subject direction:
Keep the emotional center close to rural labor, bent human bodies, earth, low sky, quiet fatigue, and dignity, but let details drift according to the description.

Avoid:
No text, no watermark, no photorealism, no direct museum UI, no frame.
`;
}

async function callOpenAI(payload) {
  let response;

  try {
    response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const cause = error.cause
      ? ` (${error.cause.code || error.cause.name || "network"}: ${error.cause.message})`
      : "";
    throw new Error(`OpenAI network request failed: ${error.message}${cause}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new Error("No text returned from OpenAI");
}

function assertApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
}
