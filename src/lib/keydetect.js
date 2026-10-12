// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Key Detector — paste anything, we figure out what it is
// ─────────────────────────────────────────────────────────────────────────────
// Accepts:
//   · one raw API key            "gsk_abc…"
//   · several keys, one/line     "gsk_abc…\nAIza123…"
//   · a whole .env file          "GROQ_API_KEY=gsk_…  # comment"
//   · export-prefixed shell      "export OPENAI_API_KEY=sk-…"
//   · quoted values              "GEMINI_API_KEY='AIza…'"
// Every hit is returned as a row; unknown formats get provider:null and the
// UI offers a picker. Nothing here touches the network or storage.

import { PROVIDERS } from '@shared/providers.js';

// env-var name → provider id (everything NexusAI's server also reads)
const ENV_NAMES = {
  OPENROUTER_API_KEY: 'openrouter',
  OPENAI_API_KEY: 'openai',
  ANTHROPIC_API_KEY: 'anthropic',
  DEEPSEEK_API_KEY: 'deepseek',
  DASHSCOPE_API_KEY: 'qwen',
  QWEN_API_KEY: 'qwen',
  GROQ_API_KEY: 'groq',
  GEMINI_API_KEY: 'gemini',
  GOOGLE_API_KEY: 'gemini',
  GITHUB_MODELS_TOKEN: 'github',
  GITHUB_TOKEN: 'github',
  GH_TOKEN: 'github',
  MISTRAL_API_KEY: 'mistral',
  CEREBRAS_API_KEY: 'cerebras',
  NVIDIA_API_KEY: 'nvidia',
  NVIDIA_NIM_API_KEY: 'nvidia',
  COHERE_API_KEY: 'cohere',
  HF_TOKEN: 'huggingface',
  HUGGINGFACE_API_KEY: 'huggingface',
  ZAI_API_KEY: 'zai',
  Z_AI_API_KEY: 'zai',
  ZHIPU_API_KEY: 'zai',
};

// provider id → canonical env-var name (used for export)
const EXPORT_NAME = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'DASHSCOPE_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  github: 'GITHUB_MODELS_TOKEN',
  mistral: 'MISTRAL_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  cohere: 'COHERE_API_KEY',
  huggingface: 'HF_TOKEN',
  zai: 'ZAI_API_KEY',
};

// key-prefix fingerprints, most-specific first
const PREFIXES = [
  [/^sk-or-v1-/, 'openrouter', false],
  [/^sk-ant-/, 'anthropic', false],
  [/^sk-proj-/, 'openai', false],
  [/^gsk_|^glsa_/, 'groq', false],
  [/^AIza[0-9A-Za-z_-]{30,}$/, 'gemini', false],
  [/^hf_/, 'huggingface', false],
  [/^github_pat_|^ghp_|^gho_|^ghu_|^ghs_|^ghr_/, 'github', false],
  [/^nvapi-/, 'nvidia', false],
  [/^csk-/, 'cerebras', false],
  // sk- + exactly 32 hex → DeepSeek or DashScope (identical format) — pick one, stay switchable
  [/^sk-[0-9a-f]{32}$/, 'deepseek', true],
  // id.secret → Z.ai GLM keys
  [/^[0-9a-f]{32}\.[0-9a-f]{16,}$/, 'zai', false],
  // generic sk- → probably OpenAI
  [/^sk-/, 'openai', true],
];

export function detectKey(raw) {
  const k = String(raw || '').trim();
  if (!k || /\s/.test(k)) return null;
  for (const [re, provider, guess] of PREFIXES) {
    if (re.test(k)) return { provider, guess };
  }
  return null;
}

const looksLikeKey = (s) =>
  s.length >= 16 && /^[A-Za-z0-9_.\-]+$/.test(s) && /[A-Za-z0-9]/.test(s);

function cleanValue(v) {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function maskKey(k) {
  const s = String(k || '');
  if (s.length <= 12) return s.slice(0, 4) + '…';
  return s.slice(0, 7) + '…' + s.slice(-4);
}

// parseKeys(text) → [{ provider, key, how, guess }]
//   how: 'env:GROQ_API_KEY' | 'prefix' | 'unknown'
// Dedupes per provider (last value wins). provider may be null → UI picker.
export function parseKeys(text) {
  const out = new Map(); // provider|null → row
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//')) continue;

    // 1 · env-style:  [export ]NAME=value   (trailing # comments are stripped —
    //    keys never contain spaces/#, so this is always safe)
    const env = raw.match(/^(?:export\s+)?([A-Z][A-Z0-9_]{2,40})\s*=\s*(.+)$/);
    if (env) {
      const name = env[1];
      const val = cleanValue(env[2].replace(/\s+#.*$/, ''));
      const provider = ENV_NAMES[name];
      if (provider && val && looksLikeKey(val)) {
        out.set(provider, { provider, key: val, how: `env:${name}`, guess: false });
      }
      continue; // named-but-unknown env vars are ignored, never treated as raw keys
    }

    // 2 · bare key on its own line
    const val = cleanValue(raw);
    if (!looksLikeKey(val)) continue;
    const hit = detectKey(val);
    if (hit) {
      out.set(hit.provider, { provider: hit.provider, key: val, how: 'prefix', guess: hit.guess });
    } else {
      out.set('__unknown' + (out.size), { provider: null, key: val, how: 'unknown', guess: false });
    }
  }

  return [...out.values()].filter((r) => r.key);
}

// exportEnv(keys) → a .env backup file body from the browser key store
export function exportEnv(keys) {
  const names = Object.keys(keys || {})
    .map((pid) => {
      const name = EXPORT_NAME[pid];
      const p = PROVIDERS.find((x) => x.id === pid);
      return name ? `${name}=${keys[pid]} # ${p ? p.name : pid}` : null;
    })
    .filter(Boolean);
  if (!names.length) return '';
  return `# NexusAI API keys backup — ${new Date().toISOString().slice(0, 10)}\n# Import: Keys → Quick Connect → paste this file\n${names.join('\n')}\n`;
}
