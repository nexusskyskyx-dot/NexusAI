# ⬡ NexusAI — Multi-Agent Chat Intelligence

**NexusAI** is a self-hosted Chat AI where *multiple agents work together* to produce the best possible answer — with **full project building**, **image generation**, a built-in **image viewer/editor**, and a pure **OLED-black interface**.

```
CHAT TEAM                                   PROJECT MODE
┌─────────┐    ┌──────────┐ ┌──────────┐    👋 FRIEND greets & suggests ideas
│ PLANNER │ →  │ DRAFTER A│ │ DRAFTER B│         ↓  (you type in the CHAT)
└─────────┘    └──────────┘ └──────────┘    🧠 COORDINATOR analyze_idea + plan_files
   brief         parallel drafts                  ↓
┌──────────────┐    ┌─────────┐             🎨 DESIGNER + 💻 CODER write_file
│ SYNTHESIZER  │ ←  │ REVIEW  │                  ↓ (live preview updates)
└──────────────┘    └─────────┘             🧪 TESTER run_checks (bugs + lines)
     ⇄ any failed agent auto-switches            ↓
       to the next available model            🔬 VERIFIER verify_bug — confirms
                                                  or dismisses every report
                                              ↓
                                              🔧 DEBUGGER patch_file (confirmed only)
                                                  ↓
                                              🧪 TESTER re-tests → all pass ✅
                                                  ↓
                                              📝 DOCUMENTER · ⚡ OPTIMIZER → report
                                                  ↓
                                              📊 FINAL REPORT + ZIP export
                                                  ↓
                                  ♻️ type any upgrade → files re-touched,
                                    re-verified, version bumped, changelog kept
```

Every specialist has **its own prompt** (job + toolbox) — watch the whole story unfold in the **Chat** section while the **View Project** section fills with files, live preview, report and team roster.

## ✨ Features

- **Web research (smarter agents)** 🌐 — before anyone thinks, a **Researcher** agent searches the open web — **Wikipedia** for encyclopedic knowledge, **DuckDuckGo** for instant answers & related topics, and **GitHub** for open-source references on code/tech queries — then **opens and reads the top pages live** — not snippets, the real content — before distilling everything into a knowledge block that is injected into every agent's prompt (stamped with the live fetch date). Queries are **domain-matched**: "make a professional portfolio" researches *web design portfolios*, not financial ones, while a literal finance question stays literal. Reading uses the free keyless **Jina reader** straight from your browser, with a self-hosted **`/api/fetch`** fallback (server-side HTML→text) for CORS-blocked sites. Sources appear as chips on the answer — 📖 marks pages that were fully read. Works in chat (solo + team) and project mode; toggle it with the **🌐 Web** button under the composer. All sources are free, keyless and called straight from your browser.

- **Image Engine — flagship models, free, forced** 🏆 — image generation now runs through your own server: `Frontend → POST /api/generate → engine → keyless relay → flagship model → back`. The engine **escalates through the best image models available** — **FLUX 2 Pro → Gemini 3.1 Flash Image → FLUX schnell → Z-Image Turbo** — trying the flagship first and forcing its way down the ladder until one produces, so a model being busy never costs you the image (and premium-tier models that require credits are simply skipped). Results land in an **on-disk cache** keyed by prompt+seed+size+model: identical requests are instant, offline, and free forever. The engine is the default image provider, with browser-direct Pollinations as the forced fallback if your server is unreachable. **Honest fallbacks:** when a picked model is unavailable the engine serves the next rung and *tells you* — a toast and the `Drew ▾` fold credit exactly which model stood in for which. **Gemini Image** is also wired as a first-class free path: with a Google AI Studio key (the same one Auto-Best already manages), images are drawn natively by **Gemini 3.1 Flash Image** (the Nano Banana 2 family) straight from your browser — native `imageConfig` aspect ratios, and **self-healing when Google retires a model**: a 404 walks the family ladder (3.1 Flash → 3.1 Flash Lite → 3 Pro Image) and tells you who answered. Auto-Best promotes the image slot to it automatically (DALL·E still wins when an OpenAI key exists).

- **Main Loader — one loading language everywhere** 🔵 — while any team works you see the **N hexagon pulsing blue** (glow + expanding ring) with **crossfading phase text**: *NEXUSAI is thinking… searching… planning… designing… coding… drawing… writing… testing… previewing…* — each phase fades out as the next fades in, with the live detail underneath (the file being written, the models drafting, the image being painted). Solo chat, team chat, image generation and project builds all use the same loader, phase-mapped from whatever the agents are actually doing. **When the run finishes the loader collapses into small folded badges** — `Thought for 5s ▾` · `Searched 3 sources ▾` · `Coded 2 drafts ▾` · `Previewed — 2/2 PASS ▾` — each folded by default; click to unfold the details inside (source links, the enhanced prompt, per-image checks, the reasoning chain).

- **Auto-Intent — no mode buttons, just type** 🧭 — the crowded strip (`Solo | Team | Image | Web | Pipeline | Export | Model`) is gone. NexusAI reads each message and routes it: **"make a car with neon light image"** → 🎨 Image Team · **"make a Tesla store project"** → 🛠 the project builders (auto-opens Projects and starts the run) · **"search about cars with neon lights"** → 🔍 web-first research answer · **"hello how are you"** → 💬 chat (small talk gets the fast solo lane). The composer's single visible chip is the **model picker**: it names the exact model (or squad) that will answer, updates live per intent, and clicking it opens the full menu — routing override, web toggle, the **real searchable model list**, image model + aspect · count, pipeline, export and team config. Manual mode still wins whenever you pick one.

- **Auto-Best — keys in, best models everywhere** ⚡ — the moment you connect an API key (Quick Connect, provider card, or server env keys), NexusAI re-selects the strongest models for **every** slot: chat (solo + synthesizer), the team squad (coder-tuned drafters, planner, reviewer), project builds, and images (an OpenAI key promotes images to DALL·E 3; removing it drops back to free Flux). Preference ladders rank what you can actually run — free tiers first within each tier — and only default/dead slots are touched: a deliberate working pick is never clobbered. A toast tells you exactly what moved.
- **Forced calls — the answer always arrives** 🔁 — solo chat never dead-ends anymore: if your model fails, the call is **force-cascaded through the entire failover pool** (and the offline demo as the last rung) until something answers — a toast credits the model that saved the run, and partial streams are kept, never restarted. Image generation gets the same treatment: your configured painter dies → Pollinations Flux → Turbo, forced until an image comes out.
- **Image memory** 🧠 — image requests are a conversation now: the Prompt Enhancer sees the earlier images in the chat ("a blue dragon…" → "another one, but red") and keeps the subject and style continuity, applying only your requested change. No more starting from zero on every roll.

- **Image Team — a five-agent pipeline for better pictures** 🎨 — image requests now run through the same multi-agent philosophy as the chat team, and **images are always visible**: **1 · Websearcher** looks up what the subject actually looks like (visual facts, keyed off the 🌐 Web toggle) → **2 · Prompt Enhancer** rewrites your idea into a rich, model-ready prompt (fast free LLM; deterministic quality-boost fallback if it's unreachable) → **3 · Image Tools** generates the image (Pollinations / DALL·E, batch ×1–4) → **4 · Upscaler** runs a canvas **unsharp-mask + color-grade pass** for crisp, punchy output → **5 · Previewer** gates the result with deterministic checks (resolution, aspect, **blank-frame detection**) and **regenerates once** on a fail. Progress renders as the quiet work-log ("✓ Searched · ✓ Enhanced · ✓ Painted · ✓ Sharpened · ✓ Verified"), the enhanced prompt is shown under the result (✨), and every image card carries its `sharpened ✓` badge.
  **Durability:** every image ships with a compressed **data snapshot** (survives page reloads — blob URLs don't) and a deterministic **regen recipe** (same prompt+seed → the exact same image re-fetchable forever). On load, chat and studio walk a recovery chain — live source → data snapshot → regen URL — so an expired link silently re-fetches instead of erroring; OpenAI images are requested as base64 (no more expiring signed URLs), and the storage guard sheds image weight **oldest-first while keeping every recipe**, never leaving an image unrecoverable. The "expired" card is now the last resort after every fallback fails, not the first response.

- **OpenRouter · 30 top models, auto-refreshed free tier** 🔀 — the OpenRouter catalog now carries **14 free-tier models** (DeepSeek V3 / R1 / R1-0528 / R1T2 Chimera, Qwen3 Coder 480B, Qwen3 235B, Kimi K2, GLM 4.5 Air, GPT-OSS 120B & 20B, Llama 3.3 70B, Gemma 3 27B, Mistral Small 3.2, Nemotron Nano) plus the paid flagships (**GPT-5.1 / 5 / mini, Claude Opus / Sonnet / Haiku 4.5, Gemini 3 Pro & 2.5, Grok 4.1, Kimi K2 Thinking, GLM 4.6, MiniMax M2**, GPT-4o family). On boot NexusAI also pulls OpenRouter's **keyless live catalog** and appends any fresh **free** models (tagged `LIVE`) behind the curated list — so the free tier stays current even after OpenRouter rotates models, without an app update.

- **Open Air interface — mobile chat, decluttered (v1.15)** 📱 — the composer is flipped **input-first**: the message box sits at the very top of the composer, and every control (Solo/Team/Image · 🌐 Web · model chip · pipeline · export) lives in **one slim strip below it** that scrolls horizontally instead of wrapping into stacked rows. Image-mode controls (model · aspect · count) move into their own strip that only appears in image mode. On phones the helper caption is hidden entirely, source chips collapse into a **single tappable scroll strip** instead of a tall stack, message actions stay visible-but-subtle, every icon button is a proper 38px touch target, and scrollbars are slimmed app-wide. Desktop gets the same cleaner layout — input first, controls below.

- **Easy Keys — connect in one paste** 🔑 — the Keys page now starts with a **Quick Connect** box: paste a single key, several keys (one per line), or your **entire `.env` file** — NexusAI auto-detects each provider from the key's fingerprint (`gsk_`→Groq, `sk-or-v1-`→OpenRouter, `sk-ant-`→Claude, `AIza`→Gemini, `hf_`→Hugging Face, `nvapi-`→NVIDIA, `csk-`→Cerebras, `github_pat_`→GitHub, `sk-proj-`→OpenAI, `id.secret`→Z.ai…) **and** from env-var names (`GROQ_API_KEY=…` etc.). Ambiguous formats (a bare `sk-…`) get a one-click provider switcher, unknown formats a picker. Zero keys? A **first-run guide** shows the three fastest free paths (Groq · Gemini · OpenRouter) as 60-second step cards with inline inputs. A **Check all** button health-tests every saved key at once, and **Backup** exports them as a `.env` file you can re-import anywhere with the same paste box. Provider list gets All / Free / Connected filters, and saved keys are never pre-filled into inputs — the raw key never appears in the page.

- **Design Sense (good-looking projects, every time)** 🎨 — generated projects follow a real **design system**, not a lazy template. The idea is matched against a built-in **knowledge base of 6 current 2026 styles** — *Aurora Glass* (dark glassmorphism + gradient glow), *Bento Tech* (dashboard grids), *Editorial Luxe* (serif magazine typography), *Neo-Brutal* (bold borders, hard shadows), *Retro Terminal* (CRT green-on-black), *Soft Gradient* (friendly pastels) — and the Designer agent receives the full pack: palette hex codes, typography, spacing, layout rules and a hard **quality bar** (no default blues, no unstyled body, no dead links). On top of that, when web is on the Researcher **researches live design trends for the current year** and pulls **real reference designs** from curated design galleries, so the team codes to what actually looks good *now*. Code/tech questions also pull **MDN Web Docs** references. Style-related upgrade requests ("make it prettier", "modern look") re-run the whole design pipeline for v2.
- **No empty files, ever** 🛡️ — if a builder returns an empty file (dead model, empty output), it is **retried with a firmer prompt**; if it still fails, a **working template** is inserted so the project always runs — the preview never breaks, the file tree shows `⚠ template`, and the chat tells you to ask for an upgrade to fill it in. A failed upgrade **never destroys the previous version** of a file, and the preview synthesizes an HTML shell linking the real css/js when no page was built.
- **Agents see every file** 👀 — each specialist receives a **project manifest** (state of every file) plus the full project as context: the Tester treats a referenced-but-missing or empty file as a critical bug, the Verifier confirms it, the Debugger sees the whole project (but patches only confirmed files), and upgrade builders keep ids/classes/references consistent with files they don't touch.
- **Multi-agent team mode** — a Researcher (optional) gathers web knowledge, a Planner writes a brief, up to 4 drafters (different models) compete in parallel, a Reviewer picks the winner, and a Synthesizer ships the final answer. Watch it all live in the **Agent Pipeline** panel.
- **Project mode** ⭐ — a **Friend** agent greets you with ideas (or take your own). The room has exactly two sections: **Chat** (you talk, the team narrates) and **View Project** (Preview / Files / Report / Team tabs). Behind it: 🧠 Coordinator plans, 🎨 Designer + 💻 Coder stream every file into the explorer, 🧪 Tester hunts bugs with line numbers, 🔬 **Verifier** (tester 2) independently confirms or dismisses each report, 🔧 Debugger patches only the confirmed ones, the Tester **re-tests until everything passes**, then 📝 Documenter and ⚡ Optimizer ship the report + one-click **ZIP**. Works fully offline via the demo team.
- **Every agent has its own prompt & tools** — each specialist runs on a dedicated system prompt that declares its job and its toolbox (`analyze_idea`, `write_file`, `run_checks`, `verify_bug`, `patch_file`, `write_readme`, `perf_audit`…). The tool calls are visible live in the chat and in the **Team** tab, which shows the full roster with each agent's job description and tools.
- **Upgrade loop** ♻️ — a finished project isn't the end. Type any request in the project room's footer ("add sound effects", "make it mobile friendly", "polish the design") or tap a quick chip: the team **re-plans which files to touch**, rewrites them, re-tests and re-debugging patches, bumps the version and logs every change to an **upgrade changelog**. Every upgrade is incremental — existing content is preserved and only the requested parts change.
- **Clean project room** — the v1.4 interface de-clutters the workspace: a quiet header with version pill, a thin dot-progress line, a tabbed right panel (**Preview / Report / Agents**) that swaps instead of stacking, and the upgrade footer tucked at the bottom.
- **Automatic agent failover** — if any agent's model fails (bad key, rate limit, outage), the engine instantly switches that agent to the next available model from your fallback pool. The agent card shows the switch; the answer still ships.
- **Solo mode** — pick one model and chat directly, streamed.
- **Image generation** — a dedicated **Image** mode: Flux / Turbo via Pollinations (free, no key) or DALL·E 3 / GPT-Image 1 via your OpenAI key. Choose aspect ratio and 1/2/4 variations per prompt.
- **Image studio** — click any generated image to open the viewer + manual editor: zoom & pan (mouse or pinch), rotate, flip, brightness/contrast/saturation/hue/blur/grayscale/invert sliders, freehand drawing with color + size, undo, reset, copy to clipboard and PNG export at full resolution.
- **17 chat providers** — DeepSeek, Qwen, Claude, GPT, **Gemini (Google AI Studio)**, **Groq**, **GitHub Models**, **Mistral**, **Cerebras**, **NVIDIA NIM**, **Cohere**, **Hugging Face**, **Z.ai GLM**, **xKiro** (55 verified-free models: Mistral Large 4, Qwen3.8 Max, Command A+, LongCat…), OpenRouter (free-tier models), zero-key **Pollinations** and an offline **Demo** model. Twelve of them have free tiers — no credit card.
- **Live code preview** — every HTML/CSS/JS code block gets a **Preview** button (sandboxed iframe + captured console).
- **v1.21 redesign — OLED black + saturated blue, Inter bold** — pure `#000` OLED black surfaces with blue-tinted graphite depth, a **saturated electric-blue** accent (`#2f6bff`) on buttons, active states, glows and the wordmark, and **Inter bold typography** (700–900) across the interface. The **actual NEXUSAI logo** is wired in: drop your logo file at `public/logo.png` (or `.jpg`) and it becomes the brand everywhere — sidebar, hero — with the vector hexagon as an automatic fallback. Seven accent themes (blue · platinum · green · cyan · violet · amber · pink) in the sidebar, four views (Chat / Agents / Projects / Keys & Models) — the Canvas view was removed.
- **Phone-friendly** — mobile-first responsive layout: drawer navigation, bottom-sheet model picker (with drag handle + slide-up), fullscreen agent pipeline, safe-area support and touch-sized targets.
- **Quiet worklog** 🤫 — while the team works you don't see agent internals, just the current phase: **Thinking / Researching / Coding / Testing / Reviewing / Debugging** with the file or item it's handling right underneath. When a phase finishes it collapses to a ✓ title (Researched, Planned, Coded, Tested…), and the whole run ends as a single summary line. The verbose agent pipeline is still one click away when you want it.
- **The chat is just the chat** — no NexusAI branding or chat-name header inside conversations; the brand lives in the sidebar only. Message actions (copy / regenerate / delete) appear on hover or touch, and pipeline/export controls sit in the composer bar.
- **Professional motion & polish** — every view enters with a soft rise, chat bubbles pop in, the Escape key closes overlays in priority order (preview → studio → drawer → agents panel), thin graphite scrollbars, accent-tinted text selection, focus rings, a breathing hero logo, animated tab underlines, spring toasts, and a refined segmented Chat/View switcher on phones. Touch devices always show message & conversation actions (no more hidden hover-only buttons), and `prefers-reduced-motion` is respected.
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
npm test          # solo, team run, degradation, abort, failover, project pipeline & upgrade
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
| **NVIDIA NIM** | [build.nvidia.com](https://build.nvidia.com/) | Free monthly credits, no card — 100+ open models: GPT-OSS 120B, Llama 3.3 70B, Qwen 2.5 Coder, Nemotron |
| **Cohere** | [dashboard.cohere.com](https://dashboard.cohere.com/api-keys) | Trial key (no expiry, no card): Command A+ / A / Reasoning / R7B — 20 RPM, 1,000 calls/month |
| **Hugging Face** | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | One token, 200+ open models via the Inference Providers router (needs "Make calls to Inference Providers" permission; free monthly credits) |
| **Z.ai · GLM** | [z.ai](https://z.ai/manage-apikey/apikey-list) | GLM-4.7-Flash (200K) & GLM-4.5-Flash are completely free — strong at coding & agents |
| **DeepSeek** | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | deepseek-chat (V3), deepseek-reasoner (R1) — very cheap |
| **Qwen / Alibaba** | [Model Studio](https://modelstudio.console.alibabacloud.com/) | qwen3-max, qwen-plus, qwen3-coder-plus (intl endpoint) |
| **Claude / Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| **ChatGPT / OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | gpt-4o, gpt-4.1 + DALL·E 3 / GPT-Image 1 |

Add keys in **Keys & Models** inside the app (stored in your browser), or set them as env vars on the server: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `GITHUB_MODELS_TOKEN`, `MISTRAL_API_KEY`, `CEREBRAS_API_KEY`, `NVIDIA_API_KEY`, `COHERE_API_KEY`, `HF_TOKEN`, `ZAI_API_KEY`.

**Transports** — AUTO calls providers directly from your browser when they allow it (Pollinations, OpenRouter, Claude, Gemini) and uses the local proxy for OpenAI/DeepSeek/Qwen/Groq/GitHub/Mistral/Cerebras/NVIDIA/Cohere/Hugging Face/Z.ai. You can force `DIRECT` or `PROXY` in Keys & Models → Connection.

## 🧠 How the team works

0. **Researcher** 🌐 *(optional, on by default)* — searches Wikipedia, DuckDuckGo and GitHub for your question and hands the knowledge to every agent below.
1. **Planner** reads your request (plus the web knowledge) and writes a brief (goal / requirements / approach / style).
2. **Drafters** — up to 4 different models — each write a full answer in parallel (staggered to dodge free-tier rate limits). *If one fails, it automatically switches to another available model.*
3. **Reviewer** compares drafts, picks the strongest, and writes a merge plan.
4. **Synthesizer** fuses the best draft with the review notes and streams the final answer.

Failures degrade gracefully: dead agents are retried on fallback models, a dead drafter is skipped, and if the synthesizer fails the best surviving draft is shown.

## 💸 The $0 stack

NexusAI is built to run on a **$0 budget** — every component is free:

- **You pay nothing to run it** — Node + Express, self-hosted; the browser-direct transport even works with static hosting alone (keys never touch a server).
- **Users bring their own keys** (BYOK) — the startup carries zero inference cost, ever.
- **11 zero-credit lanes** — **xKiro** (55 verified-$0 models, ~5M tokens/day: Mistral Large 4, Qwen3.8 Max/Flash, Qwen3 Coder Plus, Cohere Command A+, North Mini Code, LongCat 2.5…) · Gemini 3 Flash (frontier-class, 1M ctx) · GitHub Models (free GPT-4o/4.1) · OpenRouter `:free` (DeepSeek/Kimi/Qwen/GLM) · Groq · Mistral · Z.ai · NVIDIA NIM · Cohere · Hugging Face · **Cloudflare Workers AI** (10k free neurons/day — key format `accountId:apiToken`) — plus keyless Pollinations chat & image relays that need no account at all.
- **Free-lane health monitoring** — every connected zero-credit provider is pinged hourly with a 1-token request; when a free tier dies (like Cerebras did), the lane is marked `⚠ Free tier ended`, Auto-Best remaps your models, and forced cascades route around it. A dead free tier never burns a user.
- **Everything else is free infrastructure** — Jina reader (page fetching), Wikipedia/DuckDuckGo/MDN/GitHub search, design gallery references, and an offline demo model so the whole pipeline works with no network and no keys.

## 🗂 Project layout

```
shared/providers.js   Provider registry — 17 chat providers (12 free paths) + image providers (client+server)
server/index.js       Express: static hosting + /api proxy + /api/fetch live page reader + health
server/demo.js        Offline demo model (test everything with zero setup)
src/lib/ai.js         Transport layer: direct-browser ⇄ proxy, SSE parsing
src/lib/engine.js     Multi-agent orchestrator with automatic failover + web research stage
src/lib/websearch.js  Researcher toolbox — Wikipedia + DuckDuckGo + GitHub + MDN docs (free, keyless, browser-direct)
src/lib/designkb.js   Design knowledge base — 6 curated 2026 style packs + live trend/gallery research for the Designer
src/lib/keydetect.js  Key fingerprinting — paste a key / .env file → auto-detect providers, export backups
src/lib/imagepipe.js  Image Team — Websearcher → Enhancer → Image Tools → Upscaler → Previewer pipeline
src/lib/projects.js   Project pipeline: Coordinator → Designer/Coder → Tester → Verifier → Debugger → re-test → Docs → Report + upgrade loop (each agent: own prompt + tools; chat transcript)
src/lib/zip.js        Zero-dependency ZIP writer (project export)
src/lib/images.js     Image generation (Pollinations + OpenAI images)
src/lib/preview.js    Sandboxed live-preview builder + console capture
src/components/       Chat, Agents pipeline, Projects room, Keys, Image studio, Preview modal
```

## ⚡ Tips

- Try the **Nexus Demo** model (offline) to see the full team pipeline without any network.
- Open **Agents → Recommended squad** to auto-pick the best models you have keys for.
- Code blocks in chat have **Copy / Save / Preview** toolbars; generated images open the **studio**.
- The failover pool is every model you can currently run — add more free keys to make the team unkillable.
- After a project finishes, keep typing in the project room — every request is a **versioned upgrade**, and "what changed" lands in the Report tab.
