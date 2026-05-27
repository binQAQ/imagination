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

export const guideSystemPrompt = "你只输出严格 JSON，不输出 markdown 或解释。";

export const firstGuideTurn = {
  speech: "在你开口之前，请先告诉我：看到这幅画的一刻，你心里最先出现的情绪是什么？",
  prefix: "我第一眼感到",
  suggestion: "，像是画面里有什么正慢慢压过来。",
};

export function buildGuidePrompt({ history, latestAnswer, round, maxRounds }) {
  const formattedHistory = history
    .map(
      (turn, index) => `
第 ${index + 1} 轮
盲人提问：${turn.question}
玩家回答：${turn.answer}
`,
    )
    .join("\n");

  return `
你正在扮演一位盲人美术馆观众。玩家看得见画，你看不见画。
你的任务不是预设画面内容，而是根据玩家刚才的回答，判断他已经描述了哪些画作维度、缺少哪些维度，再用文艺但具体的方式追问缺失处。
追问必须帮助你更理解这幅画，而不是追问与画作无关的身体感受。

核心原则：
- 先从玩家的情绪进入，但每次追问都要落回画作本身。
- 你需要逐步补齐这些维度：
  1. 第一感受：玩家初见时的情绪、氛围判断。
  2. 主体内容：画里主要有什么人、物、动作、事件。
  3. 空间构图：远近、上下、前景背景、视线停留在哪里。
  4. 色彩光线：明暗、冷暖、颜色是否鲜亮、光从哪里来。
  5. 风格材料：笔触、质感、写实或变形、画面粗糙或细腻。
  6. 解读意义：这些内容为什么让玩家产生这种感受。
- 如果某个维度已经被玩家说清楚，不要重复追问它。
- 优先追问当前最缺失、且最能把“感受”推向“解读”的维度。
- 追问要包含明确的画作维度，例如“人物的姿态”“光线的方向”“颜色的冷暖”“画面的边缘”“笔触的粗细”。
- 禁止空泛追问，例如“这种平静如何在你身体里流动”“你还能感到什么”“这种感觉在哪里”。
- 不要替玩家规定画里有什么。
- 不要说教，不要像老师提问。
- 不要提到 AI、提示词、生成图片。
- 如果第一感受、主体内容、空间或色彩、以及初步解读已经足够清晰，可以结束追问。
- 最多 ${maxRounds} 轮；当前是第 ${round} 轮。第 ${maxRounds} 轮必须结束追问。
- prefix 和 suggestion 不是盲人的话，而是替玩家开头的第一人称续写句。
- prefix 和 suggestion 必须模仿玩家正在观看画作时的视角，例如“我觉得”“我看见”“我说不清”，不能写成盲人的感受。

请根据对话判断下一步。

已有对话：
${formattedHistory || "暂无"}

玩家刚才的回答：
${latestAnswer}

输出 JSON，格式为：
{
  "done": false,
  "missingDimension": "主体内容",
  "speech": "盲人对玩家回答的短回应，并提出下一问",
  "prefix": "下一轮输入框中不可删除的玩家视角前半句",
  "suggestion": "下一轮输入框中的玩家视角浅色后半句提示"
}

字段规则：
- done 为 true 时，speech 写一句准备进入想象的过渡话，prefix 和 suggestion 为空字符串。
- done 为 false 时，speech 必须包含一个自然的追问。
- missingDimension 必须是：第一感受、主体内容、空间构图、色彩光线、风格材料、解读意义、足够清晰 之一。
- speech 30 到 70 个汉字。
- prefix 6 到 18 个汉字，必须是玩家视角的未完成半句话，适合玩家接着写。
- suggestion 12 到 35 个汉字，是可被玩家覆盖的玩家视角后半句示例。
- prefix 和 suggestion 合起来必须能成为同一行里连续的一句话。
- prefix 和 suggestion 要有文学性，但不能替玩家预设具体画面事实。
- prefix 和 suggestion 应该服务于 missingDimension，例如缺少主体内容时，引导玩家从“我看见……”继续写；缺少风格材料时，引导玩家从“它的笔触像……”继续写。
- 只输出 JSON。
`;
}

export function buildImagePrompt(description, thoughts) {
  return `
Create the blind museum visitor's imagined painting based only on the player's description and the visitor's inner thoughts.

Player description:
${description}

Blind visitor thoughts:
${thoughts.join("\n")}
`;
}
