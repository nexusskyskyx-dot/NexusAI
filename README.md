# ⬡ NexusAI — Multi-Agent Chat Intelligence

**NexusAI** is a self-hosted Chat AI where *multiple agents work together* to produce the best possible answer — with **full project building**, **image generation**, a built-in **image viewer/editor**, and a pure **OLED-black interface**.

```
CHAT TEAM                                   PROJECT MODE
┌─────────┐    ┌──────────┐ ┌──────────┐    👋 FRIEND greets & suggests ideas
│ PLANNER │ →  │ DRAFTER A│ │ DRAFTER B│         ↓
└─────────┘    └──────────┘ └──────────┘    🧠 COORDINATOR plans files/folders
   brief         parallel drafts                  ↓
┌──────────────┐    ┌─────────┐             🎨 DESIGNER + 💻 CODER write files
│ SYNTHESIZER  │ ←  │ REVIEW  │                  ↓ (live preview updates)
└──────────────┘    └─────────┘             🧪 TESTER → 🔧 DEBUGGER → 📝 README
     ⇄ any failed agent auto-switches            ↓
       to the next available model            📊 FINAL REPORT + ZIP export
                                              ↓
                              ♻️ type any upgrade → files re-touched,
                                re-tested, version bumped, changelog kept
```

## ✨ Features

- **Multi-agent team mode** — a Planner writes a brief, up to 4 drafters (different models) compete in parallel, a Reviewer picks the winner, and a Synthesizer ships the final answer. Watch it all live in the **Agent Pipeline** panel.
- **Project mode** ⭐ — a **Friend** agent greets you with ideas (or take your own). The **Coordinator** plans the file & folder structure, then **Designer / Coder / Tester / Debugger / Documenter / Optimizer** build a complete web project: files stream into a **file explorer** (folders, sizes, line counts), a **live preview** updates as they finish, the Tester finds bugs and the Debugger patches them, and you get a **final report** + one-click **ZIP export**. Works fully offline via the demo team.
- **Upgrade loop** ♻️ — a finished project isn't the end. Type any request in the project room's footer ("add sound effects", "make it mobile friendly", "polish the design") or tap a quick chip: the team **re-plans which files to touch**, rewrites them, re-tests and re-debugging patches, bumps the version and logs every change to an **upgrade changelog**. Every upgrade is incremental — existing content is preserved and only the requested parts change.
- **Clean project room** — the v1.4 interface de-clutters the workspace: a quiet header with version pill, a thin dot-progress line, a tabbed right panel (**Preview / Report / Agents**) that swaps instead of stacking, and the upgrade footer tucked at the bottom.
- **Automatic agent failover** — if any agent's model fails (bad key, rate limit, outage), the engine instantly switches that agent to the next available model from your fallback pool. The agent card shows the switch; the answer still ships.
- **Solo mode** — pick one model and chat directly, streamed.
- **Image generation** — a dedicated **Image** mode: Flux / Turbo via Pollinations (free, no key) or DALL·E 3 / GPT-Image 1 via your OpenAI key. Choose aspect ratio and 1/2/4 variations per prompt.
- **Image studio** — click any generated image to open the viewer + manual editor: zoom & pan (mouse or pinch), rotate, flip, brightness/contrast/saturation/hue/blur/grayscale/invert sliders, freehand drawing with color + size, undo, reset, copy to clipboard and PNG export at full resolution.
- **12 chat providers** — DeepSeek, Qwen, Claude, GPT, **Gemini (Google AI Studio)**, **Groq**, **GitHub Models**, **Mistral**, **Cerebras**, OpenRouter (free-tier models), zero-key **Pollinations** and an offline **Demo** model. Nine of them have free tiers.
- **Live code preview** — every HTML/CSS/JS code block gets a **Preview** button (sandboxed iframe + captured console), plus a full **Canvas** editor with live preview.
- **OLED-black professional UI** — pure `#000`, Inter + Space Grotesk typography, 5 refined accent themes, multiple views (Chat / Agents / Canvas / Keys & Models).
- **Phone-friendly** — mobile-first responsive layout: drawer navigation, bottom-sheet model picker, fullscreen agent pipeline, Code/Preview pane switch on Canvas, safe-area support and touch-sized targets.
- **Smooth streaming** — stage-aware loading states, shimmer indicators, a glowing caret that follows the text, and a fast un-highlighted parser while streaming.
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
npm test          # solo stream, full team run, degradation, abort & automatic failover
```

## 🔑 API keys (all optional)

| Provider | Get a key | What you get |
|---|---|---|
| **Pollinations** | none needed | Free GPT / Qwen-Coder / Mistral / Llama chat + **Flux / Turbo image generation** — instant, rate-limited |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | Free tier (30 req/min): Llama 4, Llama 3.3 70B, GPT-OSS 120B — extremely fast LPUs |
| **Google AI Studio** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free Gemini 2.5 / 2.0 Flash — one of the most generous free quotas |
| **GitHub Models** | [GitHub PAT](https://github.com/settings/personal-access-tokens/new) (models: read) | Free GPT-4o / GPT-4.1 / Llama 4 with your GitHub account |
| **OpenRouter** | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) | Free-tier DeepSeek, Qwen3, Llama, GPT-OSS + paid Claude/GPT/DeepSeek with one key |
| **Mistral** | [console.mistral.ai](https://console.mistral.ai/api-keys) | Free tier (phone verification): Mistral Small |
| **Cerebras** | [cloud.cerebras.ai](https://cloud.cerebras.ai/) | Free daily quota, wafer-scale speed: Llama 3.3 70B, GPT-OSS |
| **DeepSeek** | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | deepseek-chat (V3), deepseek-reasoner (R1) — very cheap |
| **Qwen / Alibaba** | [Model Studio](https://modelstudio.console.alibabacloud.com/) | qwen3-max, qwen-plus, qwen3-coder-plus (intl endpoint) |
| **Claude / Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| **ChatGPT / OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | gpt-4o, gpt-4.1 + DALL·E 3 / GPT-Image 1 |

Add keys in **Keys & Models** inside the app (stored in your browser), or set them as env vars on the server: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `GITHUB_MODELS_TOKEN`, `MISTRAL_API_KEY`, `CEREBRAS_API_KEY`.

**Transports** — AUTO calls providers directly from your browser when they allow it (Pollinations, OpenRouter, Claude, Gemini) and uses the local proxy for OpenAI/DeepSeek/Qwen/Groq/GitHub/Mistral/Cerebras. You can force `DIRECT` or `PROXY` in Keys & Models → Connection.

## 🧠 How the team works

1. **Planner** reads your request and writes a brief (goal / requirements / approach / style).
2. **Drafters** — up to 4 different models — each write a full answer in parallel (staggered to dodge free-tier rate limits). *If one fails, it automatically switches to another available model.*
3. **Reviewer** compares drafts, picks the strongest, and writes a merge plan.
4. **Synthesizer** fuses the best draft with the review notes and streams the final answer.

Failures degrade gracefully: dead agents are retried on fallback models, a dead drafter is skipped, and if the synthesizer fails the best surviving draft is shown.

## 🗂 Project layout

```
shared/providers.js   Provider registry — 12 chat providers + image providers (client+server)
server/index.js       Express: static hosting + /api proxy + health
server/demo.js        Offline demo model (test everything with zero setup)
src/lib/ai.js         Transport layer: direct-browser ⇄ proxy, SSE parsing
src/lib/engine.js     Multi-agent orchestrator with automatic failover
src/lib/projects.js   Project pipeline: Coordinator → Designer/Coder → Tester → Debugger → Docs → Report + upgrade loop (re-plan → re-build → re-test → changelog)
src/lib/zip.js        Zero-dependency ZIP writer (project export)
src/lib/images.js     Image generation (Pollinations + OpenAI images)
src/lib/preview.js    Sandboxed live-preview builder + console capture
src/components/       Chat, Agents pipeline, Projects room, Canvas, Keys, Image studio, Preview modal
```

## ⚡ Tips

- Try the **Nexus Demo** model (offline) to see the full team pipeline without any network.
- Open **Agents → Recommended squad** to auto-pick the best models you have keys for.
- Code blocks in chat have **Copy / Save / Preview** toolbars; generated images open the **studio**.
- The failover pool is every model you can currently run — add more free keys to make the team unkillable.
- After a project finishes, keep typing in the project room — every request is a **versioned upgrade**, and "what changed" lands in the Report tab.
