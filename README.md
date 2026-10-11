# ⬡ NexusAI — Multi-Agent Chat Intelligence

**NexusAI** is a self-hosted Chat AI where *multiple agents work together* to produce the best possible answer — wrapped in a pure **OLED-black interface with bold typography**.

```
┌─────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐    ┌─────────┐
│ PLANNER │ →  │ DRAFTER A│ │ DRAFTER B│ │ DRAFTER C│ →  │ REVIEW  │
└─────────┘    └──────────┘ └──────────┘ └──────────┘    └────┬────┘
   brief         parallel drafts (different models)     verdict │
┌──────────────┐                                            ▼
│ SYNTHESIZER  │ ← best draft + review notes + brief → final streamed answer
└──────────────┘
```

## ✨ Features

- **Multi-agent team mode** — a Planner writes a brief, up to 4 drafters (different models) compete in parallel, a Reviewer picks the winner, and a Synthesizer ships the final answer. Watch it all live in the **Agent Pipeline** panel.
- **Solo mode** — pick one model and chat directly, streamed.
- **Models**: **DeepSeek** (V3 / R1), **Qwen** (Qwen3 Max / Coder via DashScope), **Claude** (Opus / Sonnet / Haiku), **ChatGPT** (GPT-4o / 4.1) — plus **free** access through **OpenRouter's free tier** (one free key) and **Pollinations** (no key at all).
- **Zero-key free mode** — works out of the box via Pollinations; add keys whenever you want the frontier models.
- **Live code preview** — every HTML/CSS/JS code block gets a **▶ PREVIEW** button (sandboxed iframe + captured console), plus a full **Canvas** editor with live preview.
- **OLED-black bold UI** — pure `#000`, Space Grotesk bold type, 5 neon accent themes, multiple views (Chat / Agents / Canvas / Keys & Models).
- **Keys stay yours** — stored in your browser's localStorage, sent per-request directly to the provider (or through your own local proxy). Nothing is ever stored server-side.

## 🚀 Run it

```bash
npm install
npm run build     # build the frontend
npm start         # serve app + API proxy on http://localhost:8787
```

Development (hot reload):

```bash
npm run dev       # API server on :8787 + Vite on :5173
```

Smoke-test the multi-agent engine (server must be running):

```bash
npm test          # runs solo stream, full team run, degradation & abort against the offline demo model
```

## 🔑 API keys (all optional)

| Provider | Get a key | What you get |
|---|---|---|
| **Pollinations** | none needed | Free GPT / Qwen-Coder / Mistral / Llama — instant, rate-limited |
| **OpenRouter** | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) | Free-tier DeepSeek, Qwen3, Llama, GPT-OSS + paid Claude/GPT/DeepSeek with one key |
| **DeepSeek** | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | deepseek-chat (V3), deepseek-reasoner (R1) — very cheap |
| **Qwen / Alibaba** | [Model Studio](https://modelstudio.console.alibabacloud.com/) | qwen3-max, qwen-plus, qwen3-coder-plus (intl endpoint) |
| **Claude / Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| **ChatGPT / OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | gpt-4o, gpt-4o-mini, gpt-4.1 |

Add keys in **Keys & Models** inside the app (stored in your browser), or set them as env vars on the server: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`.

**Transports** — AUTO calls providers directly from your browser when they allow it (Pollinations, OpenRouter, Anthropic — keys never touch a server) and uses the local proxy for OpenAI/DeepSeek/Qwen. You can force `DIRECT` or `PROXY` in Keys & Models → Connection.

## 🧠 How the team works

1. **Planner** reads your request and writes a brief (goal / requirements / approach / style).
2. **Drafters** — up to 4 different models — each write a full answer in parallel (staggered to dodge free-tier rate limits).
3. **Reviewer** compares drafts, picks the strongest, and writes a merge plan.
4. **Synthesizer** fuses the best draft with the review notes and streams the final answer.

Failures degrade gracefully: a dead drafter is skipped; if the synthesizer fails, the best surviving draft is shown.

## 🗂 Project layout

```
shared/providers.js   Provider registry (client + server share it)
server/index.js       Express: static hosting + /api proxy + health
server/demo.js        Offline demo model (test everything with zero setup)
src/lib/ai.js         Transport layer: direct-browser ⇄ proxy, SSE parsing
src/lib/engine.js     Multi-agent orchestrator
src/lib/preview.js    Sandboxed live-preview builder + console capture
src/components/       Chat, Agents pipeline, Canvas, Keys, Preview modal
```

## ⚡ Tips

- Try the **Nexus Demo** model (offline) to see the full team pipeline without any network.
- Open **Agents → Recommended Squad** to auto-pick the best models you have keys for.
- Code blocks in chat have **COPY / SAVE / ▶ PREVIEW** toolbars.
- Change the neon accent in the sidebar footer.
