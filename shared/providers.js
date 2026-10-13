// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Provider Registry (single source of truth, shared by client+server)
// ─────────────────────────────────────────────────────────────────────────────
// kind:
//   'openai'    → OpenAI-compatible /chat/completions (SSE streaming)
//   'anthropic' → Anthropic /v1/messages format
//   'demo'      → offline generator inside the NexusAI server (no network)
//
// direct: true → the browser can call the provider itself (CORS is allowed),
//                 which keeps keys in the browser and works even when the
//                 NexusAI server has no outbound internet.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDERS = [
  {
    id: 'pollinations',
    name: 'Pollinations',
    vendor: 'Free · no key',
    kind: 'openai',
    baseUrl: 'https://text.pollinations.ai/openai',
    needsKey: false,
    keyUrl: 'https://pollinations.ai',
    direct: true,
    free: true,
    note: 'Community endpoint — zero keys, zero signup. GPT, Qwen-Coder, Mistral & Llama flavors. Rate-limited, best for trying NexusAI instantly.',
    liveCatalog: 'https://text.pollinations.ai/models',
    extraBody: { referrer: 'nexusai', private: true },
    headers: () => ({}),
    models: [
      { id: 'openai', label: 'GPT (OpenAI flavor)', tags: ['FREE', 'CHAT'] },
      { id: 'qwen-coder', label: 'Qwen Coder', tags: ['FREE', 'CODE'] },
      { id: 'mistral', label: 'Mistral', tags: ['FREE', 'FAST'] },
      { id: 'llama', label: 'Llama', tags: ['FREE'] },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    vendor: '1 key · 400+ models',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://openrouter.ai/settings/keys',
    free: true,
    zeroCredit: true, // :free models bill $0.00 — the key is never charged
    direct: true,
    free: true,
    note: 'One key, 400+ models. Free tier: ~25 :free models — 50 requests/day on an unfunded account, 1,000/day once you ever buy $10 of credits. Paid flagships (Claude / GPT-5 / Gemini / Grok) need credits. The free list auto-refreshes live.',
    liveCatalog: 'https://openrouter.ai/api/v1/models',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://nexusai.app',
      'X-Title': 'NexusAI',
    }),
    models: [
      // ── free tier — where a free OpenRouter key goes far ──
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (free)', tags: ['FREE', 'CHAT'] },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)', tags: ['FREE', 'REASONING'] },
      { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 0528 (free)', tags: ['FREE', 'REASONING'] },
      { id: 'tngtech/deepseek-r1t2-chimera:free', label: 'R1T2 Chimera (free)', tags: ['FREE', 'REASONING'] },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder 480B (free)', tags: ['FREE', 'CODE'] },
      { id: 'qwen/qwen3-235b-a22b:free', label: 'Qwen3 235B (free)', tags: ['FREE', 'SMART'] },
      { id: 'moonshotai/kimi-k2:free', label: 'Kimi K2 (free)', tags: ['FREE', 'SMART'] },
      { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air (free)', tags: ['FREE', 'FAST'] },
      { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B (free)', tags: ['FREE', 'SMART'] },
      { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (free)', tags: ['FREE', 'FAST'] },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', tags: ['FREE'] },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (free)', tags: ['FREE'] },
      { id: 'mistralai/mistral-small-3.2-24b-instruct:free', label: 'Mistral Small 3.2 (free)', tags: ['FREE', 'FAST'] },
      { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nemotron Nano 9B (free)', tags: ['FREE', 'FAST'] },
      // ── paid flagships ──
      { id: 'openai/gpt-5.1', label: 'GPT-5.1', tags: ['PAID', 'SMART'] },
      { id: 'openai/gpt-5', label: 'GPT-5', tags: ['PAID', 'SMART'] },
      { id: 'openai/gpt-5-mini', label: 'GPT-5 mini', tags: ['PAID', 'FAST'] },
      { id: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5', tags: ['PAID', 'SMART'] },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', tags: ['PAID', 'CODING'] },
      { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', tags: ['PAID', 'FAST'] },
      { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', tags: ['PAID', 'SMART'] },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', tags: ['PAID', 'SMART'] },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', tags: ['PAID', 'FAST'] },
      { id: 'x-ai/grok-4.1', label: 'Grok 4.1', tags: ['PAID', 'SMART'] },
      { id: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking', tags: ['PAID', 'REASONING'] },
      { id: 'z-ai/glm-4.6', label: 'GLM 4.6', tags: ['PAID', 'CODE'] },
      { id: 'minimax/minimax-m2', label: 'MiniMax M2', tags: ['PAID', 'SMART'] },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (paid)', tags: ['PAID'] },
      { id: 'openai/gpt-4o', label: 'GPT-4o', tags: ['PAID'] },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', tags: ['PAID', 'CHEAP'] },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    vendor: 'Free tier · fastest',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    zeroCredit: true, // free tier — the key is never billed
    direct: false,
    free: true,
    note: 'Groq’s LPU inference is absurdly fast. Free tier: 30 requests/min, ~1,000/day — Llama 4, Llama 3.3 70B and GPT-OSS 120B included.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tags: ['FREE', 'SMART'] },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', tags: ['FREE', 'SMART'] },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', tags: ['FREE', '1M CTX'] },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', tags: ['FREE', 'FAST'] },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini · Google AI Studio',
    vendor: 'Free tier · frontier',
    kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    zeroCredit: true, // free tier — no card, the key is never billed
    direct: true,
    free: true,
    note: 'The strongest free tier available: Gemini 3 Flash free (rate-limited, 1M-token context) with just a Google account — the closest thing to frontier models for $0. OpenAI-compatible endpoint.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash', tags: ['FREE', 'SMART'] },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', tags: ['FREE', 'FAST'] },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tags: ['FREE'] },
    ],
  },
  {
    id: 'anthropic',
    name: 'Claude · Anthropic',
    vendor: 'API key',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    direct: true,
    note: 'Anthropic’s Claude — elite writing & coding. Called straight from your browser (keys never leave your machine) or via the local server proxy.',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
    directHeaders: () => ({
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    models: [
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', tags: ['PAID', 'SMART'] },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', tags: ['PAID', 'CODING'] },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tags: ['PAID', 'FAST'] },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', tags: ['PAID', 'FAST'] },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: 'API key',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    direct: false,
    note: 'DeepSeek V3 (deepseek-chat) and R1 (deepseek-reasoner) — extremely cheap, strong reasoning. Routed through the local server proxy.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 Chat', tags: ['CHEAP', 'CHAT'] },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 Reasoner', tags: ['CHEAP', 'REASONING'] },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen · Alibaba',
    vendor: 'API key',
    kind: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://modelstudio.console.alibabacloud.com/',
    direct: false,
    note: 'Alibaba Qwen via DashScope international (OpenAI-compatible). Free quota for new accounts. Routed through the local server proxy.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'qwen3-max', label: 'Qwen3 Max', tags: ['SMART'] },
      { id: 'qwen-max', label: 'Qwen Max', tags: ['CHAT'] },
      { id: 'qwen-plus', label: 'Qwen Plus', tags: ['BALANCED'] },
      { id: 'qwen-turbo', label: 'Qwen Turbo', tags: ['FAST'] },
      { id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', tags: ['CODE'] },
    ],
  },
  {
    id: 'github',
    name: 'GitHub Models',
    vendor: 'Free · GitHub PAT',
    kind: 'openai',
    baseUrl: 'https://models.github.ai/inference/chat/completions',
    needsKey: true,
    keyUrl: 'https://github.com/settings/personal-access-tokens/new',
    zeroCredit: true, // free with a PAT — the token is never billed
    direct: false,
    free: true,
    note: 'Free inference with your GitHub account — create a fine-grained PAT with “models: read”. GPT-4o, GPT-4.1, Llama 4 and more, rate-limited.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'openai/gpt-4o', label: 'GPT-4o', tags: ['FREE', 'SMART'] },
      { id: 'openai/gpt-4.1', label: 'GPT-4.1', tags: ['FREE', '1M CTX'] },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', tags: ['FREE', 'FAST'] },
      { id: 'meta/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout', tags: ['FREE'] },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    vendor: 'Free tier',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
    zeroCredit: true, // free Experiment tier — the key is never billed
    direct: false,
    free: true,
    note: 'Mistral La Plateforme free tier (phone verification). European, fast, solid general models. Routed through the local server proxy.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small', tags: ['FREE', 'FAST'] },
      { id: 'mistral-large-latest', label: 'Mistral Large', tags: ['PAID', 'SMART'] },
      { id: 'codestral-latest', label: 'Codestral', tags: ['PAID', 'CODE'] },
    ],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    vendor: 'Paid',
    kind: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://cloud.cerebras.ai/',
    direct: false,
    free: false,
    note: 'Cerebras wafer-scale inference — thousands of tokens/second. The free tier has ENDED (paid credits required now). Routed through the local server proxy.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', tags: ['FAST', 'SMART'] },
      { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', tags: ['FAST'] },
      { id: 'qwen-3-32b', label: 'Qwen 3 32B', tags: ['CODE'] },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    vendor: 'Free credits · no card',
    kind: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://build.nvidia.com/',
    zeroCredit: true, // free monthly credits — the key is never billed
    direct: false,
    free: true,
    note: 'NVIDIA’s hosted open-model catalog — 100+ models (Llama, GPT-OSS, Qwen Coder, Nemotron) with free monthly credits on a free developer account. No credit card.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', tags: ['FREE', 'SMART'] },
      { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', tags: ['FREE', '128K'] },
      { id: 'qwen/qwen2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', tags: ['FREE', 'CODE'] },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B', tags: ['FREE'] },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    vendor: 'Free · 10k neurons/day',
    kind: 'openai',
    baseUrl: '',
    // key format: "accountId:apiToken" — the URL is account-specific
    url: (key) => {
      const acct = String(key || '').split(':')[0];
      return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`;
    },
    keyHint: 'accountId:apiToken',
    needsKey: true,
    keyUrl: 'https://dash.cloudflare.com/?to=/:account/workers-ai',
    direct: false,
    free: true,
    zeroCredit: true, // free daily neurons — the token is never billed
    note: 'Workers AI on your Cloudflare account — 10,000 free neurons/day, no card. One key field holds both: your Account ID, a colon, then the API token (AI → Read). Llama, Mistral and Qwen served from the Cloudflare edge.',
    headers: (key) => ({ Authorization: `Bearer ${String(key || '').split(':').slice(1).join(':') || key}` }),
    models: [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast', tags: ['FREE', 'FAST'] },
      { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1', tags: ['FREE', 'SMART'] },
      { id: '@cf/qwen/qwen2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', tags: ['FREE', 'CODE'] },
    ],
  },
  {
    id: 'xkiro',
    name: 'xKiro',
    vendor: '55 free models · 5M tok/day',
    kind: 'openai',
    baseUrl: 'https://api.xkiro.com/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://xkiro.com/register',
    direct: true,
    free: true,
    zeroCredit: true, // the models below are verified $0/token on xKiro
    note: 'A gateway with one key and 129 models — 55 of them completely free ($0/token, ~5M tokens/day): Mistral Large 4, the newest Qwen3.x Max/Flash/Coder family, Cohere Command A+ and North Mini Code, Meituan LongCat and more. Paid flagships (Claude, GPT-6, Gemini) also exist here — NexusAI only lists the verified-free ones.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'mistralai/mistral-large-4-0', label: 'Mistral Large 4', tags: ['FREE', 'SMART'] },
      { id: 'qwen/qwen3.8-max:free', label: 'Qwen3.8 Max', tags: ['FREE', 'SMART'] },
      { id: 'qwen/qwen3-coder-plus:free', label: 'Qwen3 Coder Plus', tags: ['FREE', 'CODE'] },
      { id: 'cohere/command-a-plus', label: 'Command A+', tags: ['FREE', '436K CTX'] },
      { id: 'cohere/north-mini-code', label: 'North Mini Code', tags: ['FREE', 'CODE'] },
      { id: 'mistralai/codestral-2508', label: 'Codestral 25.08', tags: ['FREE', 'CODE'] },
      { id: 'qwen/qwen3.7-flash:free', label: 'Qwen3.7 Flash', tags: ['FREE', 'FAST'] },
      { id: 'mistralai/mistral-medium-3.5', label: 'Mistral Medium 3.5', tags: ['FREE'] },
      { id: 'cohere/command-a', label: 'Command A', tags: ['FREE'] },
      { id: 'qwen/qwen3.5-plus:free', label: 'Qwen3.5 Plus', tags: ['FREE', '1M CTX'] },
      { id: 'meituan/longcat-2.5-preview:free', label: 'LongCat 2.5', tags: ['FREE', '1M CTX'] },
      { id: 'meta/muse-spark-1.3-contributor:free', label: 'Muse Spark 1.3', tags: ['FREE', 'VISION'] },
      { id: 'mistralai/mistral-small-2603', label: 'Mistral Small 4', tags: ['FREE', 'FAST'] },
      { id: 'stealth/space-bunny-alpha:free', label: 'Space Bunny Alpha', tags: ['FREE', 'VISION'] },
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    vendor: 'Free trial key',
    kind: 'openai',
    baseUrl: 'https://api.cohere.ai/compatibility/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    zeroCredit: true, // trial key — the key is never billed
    direct: false,
    free: true,
    note: 'Cohere Command models via the OpenAI-compatible endpoint. Trial key never expires, no card — 20 req/min, 1,000 calls/month. Strong at RAG and long documents (256K context).',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'command-a-plus-05-2026', label: 'Command A+', tags: ['FREE', 'SMART'] },
      { id: 'command-a-03-2025', label: 'Command A (256K)', tags: ['FREE', '256K CTX'] },
      { id: 'command-a-reasoning-08-2025', label: 'Command A Reasoning', tags: ['FREE', 'REASONING'] },
      { id: 'command-r7b-12-2024', label: 'Command R7B', tags: ['FREE', 'FAST'] },
    ],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    vendor: 'Free monthly credits',
    kind: 'openai',
    baseUrl: 'https://router.huggingface.co/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://huggingface.co/settings/tokens',
    zeroCredit: true, // free monthly credits — the token is never billed
    direct: false,
    free: true,
    note: 'The Inference Providers router — one token, 200+ open models (DeepSeek, Llama, GPT-OSS, Qwen) routed to Groq/Together/Fireworks/Cerebras. Create a fine-grained token with “Make calls to Inference Providers”. Free accounts get monthly credits.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', tags: ['FREE', 'SMART'] },
      { id: 'deepseek-ai/DeepSeek-V3-0324', label: 'DeepSeek V3', tags: ['FREE', 'CHAT'] },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tags: ['FREE'] },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B', tags: ['FREE'] },
    ],
  },
  {
    id: 'zai',
    name: 'Z.ai · GLM',
    vendor: 'Free flash models',
    kind: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
    needsKey: true,
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
    zeroCredit: true, // GLM flash models are free — the key is never billed
    direct: false,
    free: true,
    note: 'Zhipu’s global GLM platform — GLM-4.7-Flash and GLM-4.5-Flash are completely free (rate-limited) and strong at coding and agents. OpenAI-compatible endpoint.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'glm-4.7-flash', label: 'GLM-4.7 Flash (200K)', tags: ['FREE', 'SMART'] },
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash (128K)', tags: ['FREE', 'FAST'] },
      { id: 'glm-4.6v-flash', label: 'GLM-4.6V Flash (vision)', tags: ['FREE', 'VISION'] },
    ],
  },
  {
    id: 'openai',
    name: 'ChatGPT · OpenAI',
    vendor: 'API key',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    direct: false,
    note: 'OpenAI GPT-4o / GPT-4.1 family + DALL·E / GPT-Image image generation. Routed through the local server proxy.',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', tags: ['SMART', 'VISION'] },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tags: ['FAST', 'CHEAP'] },
      { id: 'gpt-4.1', label: 'GPT-4.1', tags: ['SMART', '1M CTX'] },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', tags: ['FAST'] },
    ],
  },
  {
    id: 'demo',
    name: 'Nexus Demo',
    vendor: 'Offline · no key',
    kind: 'demo',
    baseUrl: '',
    needsKey: false,
    keyUrl: '',
    direct: false,
    free: true,
    note: 'Fully offline simulated model built into the NexusAI server — perfect for testing the interface, agents and code preview with zero setup.',
    headers: () => ({}),
    models: [{ id: 'nexus-demo', label: 'Nexus Demo (offline)', tags: ['FREE', 'OFFLINE'] }],
  },
];

// ── image generation providers ───────────────────────────────────────────────
// kind:
//   'pollinations-image' → free GET https://image.pollinations.ai/prompt/…
//   'openai-images'      → POST /v1/images/generations (uses the OpenAI key)
// keyRef: which chat provider's key to use (image registry shares credentials)
export const IMAGE_PROVIDERS = [
  {
    id: 'nexus-engine',
    name: 'NexusAI Engine',
    vendor: 'Free · flagship models',
    kind: 'server-image',
    baseUrl: '/api/generate',
    needsKey: false,
    keyRef: null,
    keyUrl: 'https://pollinations.ai',
    free: true,
    direct: false,
    note: 'The NexusAI server engine — FORCED escalation through flagship image models (FLUX 2 Pro → Gemini 3.1 Flash Image → FLUX schnell → Z-Image Turbo) via the free keyless relay, with an on-disk cache so repeats are instant. Runs through your own NexusAI server.',
    models: [
      { id: 'black-forest-labs/flux.2-pro', label: 'FLUX 2 Pro', tags: ['FREE', 'BEST'] },
      { id: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', tags: ['FREE', 'FLAGSHIP'] },
      { id: 'black-forest-labs/flux.1-schnell', label: 'FLUX schnell', tags: ['FREE', 'FAST'] },
      { id: 'tongyi-mai/z-image-turbo', label: 'Z-Image Turbo', tags: ['FREE', 'FAST'] },
    ],
  },
  {
    id: 'gemini-image',
    name: 'Gemini Image',
    vendor: 'Nano Banana 2 · Gemini key',
    kind: 'gemini-image',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    needsKey: true,
    keyRef: 'gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: true,
    direct: true,
    note: 'Google’s native image generation (nano-banana class) — strong prompt following and text-in-image, free tier with your Google AI Studio key. Called straight from your browser.',
    models: [
      { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', tags: ['FREE', 'BEST'] },
      { id: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite', tags: ['FREE', 'FAST'] },
      { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', tags: ['PAID', 'PRO'] },
    ],
  },
  {
    id: 'pollinations',
    name: 'Pollinations Image',
    vendor: 'Free · no key',
    kind: 'pollinations-image',
    baseUrl: 'https://image.pollinations.ai/prompt/',
    needsKey: false,
    keyRef: null,
    keyUrl: 'https://pollinations.ai',
    free: true,
    direct: true,
    note: 'Flux & Turbo image generation — completely free, no key, no signup. Runs straight from your browser.',
    models: [
      { id: 'flux', label: 'Flux', tags: ['FREE', 'QUALITY'] },
      { id: 'turbo', label: 'Turbo', tags: ['FREE', 'FAST'] },
    ],
  },
  {
    id: 'openai-images',
    name: 'DALL·E · OpenAI',
    vendor: 'Uses your OpenAI key',
    kind: 'openai-images',
    baseUrl: 'https://api.openai.com/v1/images/generations',
    needsKey: true,
    keyRef: 'openai',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: false,
    direct: false,
    note: 'DALL·E 3 and GPT-Image 1 — premium quality through your existing OpenAI key, routed via the local server proxy.',
    models: [
      { id: 'dall-e-3', label: 'DALL·E 3', tags: ['PAID', 'QUALITY'] },
      { id: 'gpt-image-1', label: 'GPT-Image 1', tags: ['PAID', 'SMART'] },
    ],
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

export function getImageProvider(id) {
  return IMAGE_PROVIDERS.find((p) => p.id === id) || null;
}

export function getModel(providerId, modelId) {
  const p = getProvider(providerId);
  if (!p) return null;
  return p.models.find((m) => m.id === modelId) || null;
}

export function modelLabel(providerId, modelId) {
  const m = getModel(providerId, modelId);
  const p = getProvider(providerId);
  if (!p) return modelId || '—';
  return m ? m.label : modelId;
}

// Serialize for /api/providers (strip functions)
export function serializeProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    vendor: p.vendor,
    kind: p.kind,
    needsKey: p.needsKey,
    keyUrl: p.keyUrl,
    direct: p.direct,
    free: !!p.free,
    zeroCredit: !!p.zeroCredit,
    keyHint: p.keyHint || null,
    note: p.note,
    liveCatalog: p.liveCatalog || null,
    models: p.models,
  }));
}
