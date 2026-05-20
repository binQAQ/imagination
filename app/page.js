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

export default function Home() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const [description, setDescription] = useState("");
  const [speech, setSpeech] = useState("我在这里。请慢慢告诉我，这幅画里有什么。");
  const [status, setStatus] = useState("等待描述");
  const [isThinking, setIsThinking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
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
    setStatus("正在想象");

    const apiThoughts = await requestThoughts(text, setStatus);
    const thoughts = apiThoughts?.length ? apiThoughts : buildThoughts(text);
    const imagePromise = requestImage(text, thoughts)
      .then((imageDataUrl) => drawApiImage(canvasRef.current, imageDataUrl))
      .catch((error) => {
        console.warn("Falling back to local painting.", error);
        setStatus(`图像接口失败，使用本地绘画：${error.message}`);
        drawImaginedPainting(canvasRef.current, text);
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
      });
    }, 3000);
  }

  function resetGame() {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    setIsThinking(false);
    setIsRevealed(false);
    setHasResult(false);
    setSpeech("我在这里。请慢慢告诉我，这幅画里有什么。");
    setStatus("等待描述");
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
            <label htmlFor="description">向他描绘这幅画</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              maxLength="520"
              placeholder="比如：田野里有三位弯腰拾麦穗的女人，天空很低，颜色朴素，画面安静又沉重。"
              required
              disabled={isThinking}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="form-actions">
              <button id="submitButton" type="submit" disabled={isThinking} hidden={hasResult}>
                描绘
              </button>
              <button id="resetButton" type="button" hidden={!hasResult} onClick={resetGame}>
                再讲一次
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

async function requestThoughts(description, setStatus) {
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
    return data.thoughts;
  } catch (error) {
    console.warn("Falling back to local thoughts.", error);
    setStatus(`文字接口失败，使用本地文案：${error.message}`);
    return null;
  }
}

async function requestImage(description, thoughts) {
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

  if (!data.imageDataUrl) {
    throw new Error("image API returned no imageDataUrl");
  }

  return data.imageDataUrl;
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
