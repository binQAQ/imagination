export const imageGenerationSettings = {
  size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
  quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
};

export function buildThoughtsPrompt(description) {
  return `
你正在扮演一位盲人美术馆观众。
玩家正在向你描述一幅美术馆中的画。

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
}

export const thoughtsSystemPrompt = "你只输出严格 JSON，不输出 markdown 或解释。";

export function buildImagePrompt(description, thoughts) {
  return `
Create the blind museum visitor's imagined painting based only on the player's description and the visitor's inner thoughts.

Player description:
${description}

Blind visitor thoughts:
${thoughts.join("\n")}
`;
}
