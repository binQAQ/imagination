# 未见之画

一个 AI 原生网页游戏原型：玩家在美术馆中向一位盲人观众描述名画，盲人通过文字逐步想象，最后生成一幅“想象中的画”。

当前版本已迁移为 Next.js：页面和 API 在同一个项目里。玩家访问网页时不需要配置 API Key；API Key 只放在开发环境或部署平台的环境变量中。

## 本地运行

安装依赖：

```powershell
npm install
```

创建 `.env.local`：

```text
OPENAI_API_KEY=你的 API Key
```

如果你需要通过自己的兼容网关或部署环境转发 OpenAI API，也可以加：

```text
OPENAI_BASE_URL=https://api.openai.com/v1
```

启动开发服务：

```powershell
npm run dev
```

访问：

```text
http://localhost:3000
```

如果没有设置 `OPENAI_API_KEY`，前端会自动回退到本地模拟文字和本地 canvas 想象画。

如果你是在 `npm run dev` 已经启动后才创建或修改 `.env.local`，需要停止服务后重新运行 `npm run dev`，Next.js 才会重新读取环境变量。

可以打开这个地址检查后端是否读到了 key：

```text
http://localhost:3000/api/health
```

其中 `hasOpenAIKey` 应该是 `true`。

如果游戏里显示 `OpenAI network request failed` 或 `fetch failed`，说明本机 Node 服务无法连接 OpenAI API。常见原因是代理/VPN 只覆盖了浏览器，没有覆盖 PowerShell/Node 进程。正式部署到 Vercel 后通常不会遇到这个本地网络问题。

## 部署

推荐部署到 Vercel。

在 Vercel 项目设置中添加环境变量：

```text
OPENAI_API_KEY=你的 API Key
```

玩家只需要打开部署后的网页，不需要知道或配置 API Key。

## 当前玩法

1. 进入一面美术馆墙。
2. 观察画框中的米勒《拾穗者》。
3. 在画作下方向盲人描述这幅画。
4. 盲人每 3 秒说出一句想象文字。
5. 文字结束后，画框中出现一幅根据描述生成的想象画。

## 文件结构

```text
.
+-- app/
|   +-- api/
|   |   +-- image/route.js
|   |   `-- thoughts/route.js
|   +-- lib/openai.js
|   +-- globals.css
|   +-- layout.js
|   `-- page.js
+-- public/
|   `-- assets/
|       +-- museum-wall.png
|       +-- blind-guide.png
|       `-- the-gleaners.jpg
+-- package.json
+-- next.config.js
`-- README.md
```

## 后续方向

- 增加可调 prompt 面板或开发者配置文件。
- 再加入结果展示与差异评价。
- 增加画作选择与关卡数据。
