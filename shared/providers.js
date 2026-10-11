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
    direct: true,
    note: 'One free account key unlocks free-tier DeepSeek, Qwen, Llama, GPT-OSS and paid Claude / GPT / DeepSeek / Qwen — all through one API.',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://nexusai.app',
      'X-Title': 'NexusAI',
    }),
    models: [
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3', tags: ['FREE', 'CHAT'] },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1', tags: ['FREE', 'REASONING'] },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder 480B', tags: ['FREE', 'CODE'] },
      { id: 'qwen/qwen3-235b-a22b:free', label: 'Qwen3 235B', tags: ['FREE'] },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', tags: ['FREE'] },
      { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B', tags: ['FREE'] },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', tags: ['PAID', 'FAST'] },
      { id: 'openai/gpt-4o', label: 'GPT-4o', tags: ['PAID', 'SMART'] },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', tags: ['PAID', 'CODING'] },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (paid)', tags: ['PAID'] },
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
    id: 'openai',
    name: 'ChatGPT · OpenAI',
    vendor: 'API key',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    direct: false,
    note: 'OpenAI GPT-4o / GPT-4.1 family. Routed through the local server proxy (OpenAI blocks direct browser calls).',
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

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
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
    note: p.note,
    liveCatalog: p.liveCatalog || null,
    models: p.models,
  }));
}
