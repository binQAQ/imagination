"use client";

import { useEffect, useRef, useState } from "react";

const palette = [
  "#3f7f78",
  "#607c8a",
  "#4b3a57",
  "#b38a3e",
  "#b65335",
  "#2a211d",
  "#d8d0bf",
  "#8b7c62",
];

const MAX_DIALOGUE_ROUNDS = 5;
const FIRST_GUIDE_TURN = {
  speech: "请你告诉我这幅画画了什么，你感受到了什么？",
  prefix: "我第一眼感到",
  suggestion: "，画面中有什么正在压过来，克制而真实。",
};

const LISTENING_LINES = [
  "我把你的话先放在心里。",
  "请稍等，我正在顺着你的描述摸索。",
  "我感受到了了一点轮廓……",
  "你的句子正在让我靠近那幅画。",
  "这幅画似乎变得更清楚了。",
  "我听着，像我能看到这幅画一般。",
  "我正在把它一点点拼起来。",
];

export default function Home() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const sessionIdRef = useRef(createSessionId());
  const [description, setDescription] = useState("");
  const [speech, setSpeech] = useState(FIRST_GUIDE_TURN.speech);
  const [status, setStatus] = useState("第 1/5 轮感受");
  const [currentQuestion, setCurrentQuestion] = useState(FIRST_GUIDE_TURN.speech);
  const [answerPrefix, setAnswerPrefix] = useState(FIRST_GUIDE_TURN.prefix);
  const [answerSuggestion, setAnswerSuggestion] = useState(FIRST_GUIDE_TURN.suggestion);
  const [dialogueTurns, setDialogueTurns] = useState([]);
  const [round, setRound] = useState(1);
  const [isThinking, setIsThinking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    logGameEvent(sessionIdRef.current, "session-start", {
      firstQuestion: FIRST_GUIDE_TURN.speech,
    });

    function updateStageScale() {
      const stage = stageRef.current;
      if (!stage) return;

      const stageWidth = 1440;
      const stageHeight = 900;
      const margin = 28;
      const widthScale = (window.innerWidth - margin * 2) / stageWidth;
      const heightScale = (window.innerHeight - margin * 2) / stageHeight;
      const scale = Math.min(1, widthScale, heightScale);
      const aspect = window.innerWidth / window.innerHeight;
      const squarePressure = clamp((1.6 - aspect) / 0.55, 0, 1);
      const guideWidth = lerp(500, 420, squarePressure);
      const guideLeft = lerp(865, 815, squarePressure);

      stage.style.setProperty("--stage-scale", Math.max(0.46, scale).toFixed(3));
      stage.style.setProperty("--guide-width", `${guideWidth.toFixed(1)}px`);
      stage.style.setProperty("--guide-left", `${guideLeft.toFixed(1)}px`);
    }

    updateStageScale();
    window.addEventListener("resize", updateStageScale);

    return () => window.removeEventListener("resize", updateStageScale);
  }, []);

  useEffect(() => {
    return () => window.clearInterval(timerRef.current);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = description.trim();

    if (!text) return;

    setIsThinking(true);
    setIsRevealed(false);
    setHasResult(false);
    setStatus("正在倾听");
    setSpeech(getRandomListeningLine());

    const answer = `${answerPrefix}${text}`;
    const nextTurns = [
      ...dialogueTurns,
      {
        question: currentQuestion,
        answer,
      },
    ];
    logGameEvent(sessionIdRef.current, "player-answer", {
      round,
      question: currentQuestion,
      prefix: answerPrefix,
      typedText: text,
      submittedAnswer: answer,
    });

    if (round >= MAX_DIALOGUE_ROUNDS) {
      await finishDialogue(nextTurns, "我听见了。你的感受已经有了形状，现在让我试着把它想象出来。");
      return;
    }

    try {
      const guide = await requestDialogue({
        history: dialogueTurns,
        latestAnswer: answer,
        round,
      });
      logGameEvent(sessionIdRef.current, "api-dialogue", {
        request: {
          history: dialogueTurns,
          latestAnswer: answer,
          round,
        },
        response: guide,
      });

      if (guide.done) {
        await finishDialogue(nextTurns, guide.speech);
        return;
      }

      setDialogueTurns(nextTurns);
      setDescription("");
      setSpeech(guide.speech);
      setCurrentQuestion(guide.speech);
      setAnswerPrefix(guide.prefix || "我还感觉到");
      setAnswerSuggestion(guide.suggestion || "，但那种感觉还停在画面的边缘。");
      setRound((value) => value + 1);
      setStatus(`第 ${round + 1}/5 轮感受`);
      setIsThinking(false);
    } catch (error) {
      console.warn("Falling back to local guide.", error);
      const fallback = buildGuideFallback(round, answer);
      logGameEvent(sessionIdRef.current, "api-dialogue-error", {
        request: {
          history: dialogueTurns,
          latestAnswer: answer,
          round,
        },
        error: error.message,
        fallback,
      });

      if (fallback.done) {
        await finishDialogue(nextTurns, fallback.speech);
        return;
      }

      setDialogueTurns(nextTurns);
      setDescription("");
      setSpeech(fallback.speech);
      setCurrentQuestion(fallback.speech);
      setAnswerPrefix(fallback.prefix);
      setAnswerSuggestion(fallback.suggestion);
      setRound((value) => value + 1);
      setStatus(`追问接口失败，使用本地追问：第 ${round + 1}/5 轮`);
      setIsThinking(false);
    }
  }

  async function finishDialogue(turns, transitionSpeech) {
    const fullDescription = buildDialogueDescription(turns);

    setDialogueTurns(turns);
    setDescription("");
    setSpeech(transitionSpeech || "我听见了。现在让我试着把它想象出来。");
    setCurrentQuestion("");
    setAnswerPrefix("");
    setAnswerSuggestion("");
    setStatus("正在想象");
    logGameEvent(sessionIdRef.current, "dialogue-finished", {
      turns,
      fullDescription,
      transitionSpeech,
    });

    const apiThoughts = await requestThoughts(fullDescription, setStatus, sessionIdRef.current);
    const thoughts = apiThoughts?.length ? apiThoughts : buildThoughts(fullDescription);
    const imagePromise = requestImage(fullDescription, thoughts, sessionIdRef.current)
      .then((imageDataUrl) => drawApiImage(canvasRef.current, imageDataUrl))
      .catch((error) => {
        console.warn("Falling back to local painting.", error);
        setStatus(`图像接口失败，使用本地绘画：${error.message}`);
        logGameEvent(sessionIdRef.current, "api-image-error", {
          description: fullDescription,
          thoughts,
          error: error.message,
        });
        drawImaginedPainting(canvasRef.current, fullDescription);
      });

    playThoughts(thoughts, imagePromise);
  }

  function playThoughts(thoughts, imagePromise) {
    let index = 0;
    setSpeech(thoughts[index]);

    timerRef.current = window.setInterval(() => {
      index += 1;

      if (index < thoughts.length) {
        setSpeech(thoughts[index]);
        return;
      }

      window.clearInterval(timerRef.current);
      timerRef.current = null;
      setStatus("正在绘出想象");
      imagePromise.finally(() => {
        setIsThinking(false);
        setSpeech("我好像看见了。它不是原来的画，却是你给我的那幅画。");
        setStatus("想象完成");
        setIsRevealed(true);
        setHasResult(true);
        logGameEvent(sessionIdRef.current, "session-complete", {
          dialogueTurns,
          thoughtCount: thoughts.length,
        });
      });
    }, 3000);
  }

  function resetGame() {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    setIsThinking(false);
    setIsRevealed(false);
    setHasResult(false);
    setSpeech(FIRST_GUIDE_TURN.speech);
    setStatus("第 1/5 轮感受");
    setCurrentQuestion(FIRST_GUIDE_TURN.speech);
    setAnswerPrefix(FIRST_GUIDE_TURN.prefix);
    setAnswerSuggestion(FIRST_GUIDE_TURN.suggestion);
    setDialogueTurns([]);
    setRound(1);
    setDescription("");
    sessionIdRef.current = createSessionId();
    logGameEvent(sessionIdRef.current, "session-start", {
      firstQuestion: FIRST_GUIDE_TURN.speech,
    });
  }

  return (
    <main className="museum" aria-label="未见之画游戏场景">
      <section ref={stageRef} id="stage" className="stage" aria-live="polite">
        <div className="painting-area">
          <figure className={`frame ${isRevealed ? "revealed" : ""}`} aria-label="画框中的拾穗者">
            <img
              id="originalPainting"
              className="painting original-painting"
              src="/assets/the-gleaners.jpg"
              alt="让-弗朗索瓦·米勒的油画《拾穗者》"
            />
            <canvas
              ref={canvasRef}
              id="imaginedCanvas"
              className="painting imagined-painting"
              width="960"
              height="640"
              aria-label="盲人想象中的画"
            />
          </figure>

          <form id="describeForm" className="description-form" onSubmit={handleSubmit}>
            <label htmlFor="description">{hasResult ? "这一次想象已经完成" : "把你的感受交给他"}</label>
            <div className="guided-input">
              {answerPrefix ? <div className="locked-prefix">{answerPrefix}</div> : null}
              <textarea
                id="description"
                name="description"
                rows="4"
                maxLength="520"
                placeholder={answerSuggestion}
                required
                disabled={isThinking || hasResult}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="form-actions">
              <button id="submitButton" type="submit" disabled={isThinking} hidden={hasResult}>
                {round >= MAX_DIALOGUE_ROUNDS ? "让他想象" : "告诉他"}
              </button>
              <button id="resetButton" type="button" hidden={!hasResult} onClick={resetGame}>
                再讲一次
              </button>
              <button id="exportButton" type="button" hidden={!hasResult} onClick={exportGameLogs}>
                导出记录
              </button>
            </div>
          </form>
        </div>

        <div id="speechBubble" className={`speech-bubble ${isThinking ? "thinking" : ""}`}>
          {speech}
        </div>

        <img
          className="blind-guide"
          src="/assets/blind-guide.png"
          alt="一位戴墨镜、手持盲杖的盲人观众"
        />

        <div id="statusLine" className="status-line">
          {status}
        </div>
      </section>
    </main>
  );
}

async function requestDialogue({ history, latestAnswer, round }) {
  const response = await fetch("/api/dialogue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ history, latestAnswer, round }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || `API responded with ${response.status}`);
  }

  return response.json();
}

async function requestThoughts(description, setStatus, sessionId) {
  try {
    const response = await fetch("/api/thoughts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || data.error || `API responded with ${response.status}`);
    }

    const data = await response.json();
    logGameEvent(sessionId, "api-thoughts", {
      request: { description },
      response: data,
    });
    return data.thoughts;
  } catch (error) {
    console.warn("Falling back to local thoughts.", error);
    setStatus(`文字接口失败，使用本地文案：${error.message}`);
    logGameEvent(sessionId, "api-thoughts-error", {
      request: { description },
      error: error.message,
    });
    return null;
  }
}

async function requestImage(description, thoughts, sessionId) {
  const response = await fetch("/api/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description, thoughts }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || `API responded with ${response.status}`);
  }

  const data = await response.json();
  logGameEvent(sessionId, "api-image", {
    request: { description, thoughts },
    response: {
      ...data,
      imageDataUrl: summarizeImageDataUrl(data.imageDataUrl),
    },
  });

  if (!data.imageDataUrl) {
    throw new Error("image API returned no imageDataUrl");
  }

  return data.imageDataUrl;
}

function buildDialogueDescription(turns) {
  return turns
    .map((turn, index) => `第 ${index + 1} 轮\n盲人：${turn.question}\n玩家：${turn.answer}`)
    .join("\n\n");
}

function buildGuideFallback(round, answer) {
  if (round >= 3 || answer.length > 80) {
    return {
      done: true,
      speech: "我已经听见那种感觉怎样贴近画面了。现在请让我把你说的东西慢慢想出来。",
    };
  }

  return {
    done: false,
    speech: "我听见了这种感觉。为了让我看清它，请告诉我：画面里的主体、颜色或光线，哪一样最先把它推到你面前？",
    prefix: "我最先看见",
    suggestion: "，它让整幅画的情绪变得更清楚。",
  };
}

function getRandomListeningLine() {
  return LISTENING_LINES[Math.floor(Math.random() * LISTENING_LINES.length)];
}

function createSessionId() {
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function logGameEvent(sessionId, type, payload) {
  if (typeof window === "undefined" || !sessionId) return;

  try {
    const key = "imagination-game-logs";
    const logs = JSON.parse(window.localStorage.getItem(key) || "[]");
    let session = logs.find((item) => item.sessionId === sessionId);

    if (!session) {
      session = {
        sessionId,
        startedAt: new Date().toISOString(),
        events: [],
      };
      logs.unshift(session);
    }

    session.updatedAt = new Date().toISOString();
    session.events.push({
      type,
      at: new Date().toISOString(),
      payload,
    });

    window.localStorage.setItem(key, JSON.stringify(logs.slice(0, 25)));
  } catch (error) {
    console.warn("Failed to write game log.", error);
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

function exportGameLogs() {
  if (typeof window === "undefined") return;

  const logs = window.localStorage.getItem("imagination-game-logs") || "[]";
  const blob = new Blob([logs], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `imagination-game-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawApiImage(canvas, imageDataUrl) {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext("2d");
    const image = new Image();

    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve();
    };

    image.onerror = () => reject(new Error("generated image could not be loaded by the browser"));
    image.src = imageDataUrl;
  });
}

function buildThoughts(description) {
  const text = description.replace(/\s+/g, "");
  const hasPeople = /人|女人|农民|她|他|他们|她们|身体|背|腰/.test(text);
  const hasField = /田|地|麦|稻|草|土地|农/.test(text);
  const hasSky = /天|云|光|黄昏|傍晚|太阳/.test(text);
  const hasColor = /黄|蓝|灰|暗|亮|红|绿|褐|黑|白|颜色|色/.test(text);
  const hasMood = /安静|沉重|孤独|疲惫|温柔|压抑|庄严|悲伤/.test(text);

  return [
    hasField
      ? "我先感觉到一片低低的土地，像粗糙的布贴近脚边。"
      : "我先感觉到一个开阔但安静的地方，边缘有些模糊。",
    hasPeople
      ? "那里有人弯着身体，动作很慢，像在小心寻找什么。"
      : "我还不能确定那里是谁，只感觉到几个沉默的轮廓。",
    hasColor
      ? "颜色在我心里不是鲜亮的，更像旧衣服上的尘土。"
      : "我想象它的颜色很低，像被时间压暗了一层。",
    hasSky
      ? "天空应该很宽，却没有把人托起来，反而压得很近。"
      : "画面上方有一块安静的空气，像没有声音的墙。",
    hasMood
      ? "你说的情绪让我想到疲惫，但不是绝望，是一种忍耐。"
      : "我听见一种缓慢的沉默，好像画里的人不愿打扰彼此。",
    "我开始把这些形状拼起来：土地、衣褶、弯下去的背。",
    "它在我脑中变成一幅粗粝的画，边线深，颜色旧，光很低。",
    "有些地方我仍看不清，只能让它们停在阴影里。",
    "我把你说过的颜色放得很轻，像怕惊动那些人。",
    "画面的边缘慢慢退开，中间留下沉默的动作。",
    "我感觉这不是一瞬间，而是一整天压下来的重量。",
    "最后它聚成一幅安静的图，像听见之后才出现的风景。",
  ];
}

function drawImaginedPainting(canvas, description) {
  const ctx = canvas.getContext("2d");
  const seed = hashString(description);
  const random = mulberry32(seed);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#cbbf9f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  paintBackground(ctx, canvas, random);
  paintHorizon(ctx, canvas, random);
  paintFigures(ctx, canvas, random);
  paintScratches(ctx, canvas, random);
  paintCanvasGrain(ctx, canvas, seed);
}

function paintBackground(ctx, canvas, random) {
  for (let i = 0; i < 24; i += 1) {
    ctx.globalAlpha = 0.2 + random() * 0.22;
    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    const x = random() * canvas.width;
    const y = random() * canvas.height * 0.75;
    const w = 80 + random() * 260;
    const h = 60 + random() * 190;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
  }

  ctx.globalAlpha = 1;
}

function paintHorizon(ctx, canvas, random) {
  const horizon = canvas.height * (0.45 + random() * 0.13);
  ctx.fillStyle = "#86785f";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  ctx.strokeStyle = "#2a211d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, horizon + random() * 8);
  for (let x = 80; x <= canvas.width; x += 80) {
    ctx.lineTo(x, horizon + random() * 18 - 9);
  }
  ctx.stroke();
}

function paintFigures(ctx, canvas, random) {
  const count = 3;
  const baseY = canvas.height * 0.73;

  for (let i = 0; i < count; i += 1) {
    const x = canvas.width * (0.28 + i * 0.2 + random() * 0.04);
    const height = 150 + random() * 70;
    const bend = 40 + random() * 44;

    ctx.save();
    ctx.translate(x, baseY + random() * 20);
    ctx.rotate((-0.12 + random() * 0.18) * (i === 1 ? -1 : 1));

    ctx.strokeStyle = "#16120f";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.fillStyle = palette[(i + 2) % palette.length];

    ctx.beginPath();
    ctx.moveTo(-34, -height * 0.18);
    ctx.lineTo(18, -height * 0.2 - bend);
    ctx.lineTo(48, -height * 0.04);
    ctx.lineTo(30, 0);
    ctx.lineTo(-28, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette[(i + 5) % palette.length];
    ctx.beginPath();
    ctx.moveTo(11, -height * 0.22 - bend);
    ctx.lineTo(54, -height * 0.25 - bend * 0.72);
    ctx.lineTo(38, -height * 0.02);
    ctx.lineTo(6, -height * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8b6f4a";
    ctx.beginPath();
    ctx.arc(20, -height * 0.28 - bend, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

function paintScratches(ctx, canvas, random) {
  ctx.globalAlpha = 0.38;

  for (let i = 0; i < 90; i += 1) {
    ctx.strokeStyle = random() > 0.52 ? "#eee2c8" : "#231c18";
    ctx.lineWidth = 1 + random() * 2.5;
    ctx.beginPath();
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    ctx.moveTo(x, y);
    ctx.lineTo(x + random() * 80 - 40, y + random() * 30 - 15);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function paintCanvasGrain(ctx, canvas, seed) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = ((i * 17 + seed) % 23) - 11;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }

  ctx.putImageData(image, 0, 0);
}

function hashString(value) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed) {
  return function nextRandom() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}
