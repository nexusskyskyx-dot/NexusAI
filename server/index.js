// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Server — static hosting + /api proxy + offline demo model
// The proxy is a dumb authenticated pipe: your keys are passed per-request and
// are NEVER written to disk. Optionally provide keys via environment variables.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeProviders, PROVIDERS, IMAGE_PROVIDERS } from '../shared/providers.js';
import { streamDemo, demoResponse } from './demo.js';
import { generateImage as engineGenerate } from './imagegen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = process.env.PORT || 8787;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

// Keys provided via environment (optional) — used when the request carries none.
const ENV_KEYS = {
  openrouter: process.env.OPENROUTER_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  qwen: process.env.DASHSCOPE_API_KEY,
  groq: process.env.GROQ_API_KEY,
  gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  github: process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN,
  mistral: process.env.MISTRAL_API_KEY,
  cerebras: process.env.CEREBRAS_API_KEY,
  nvidia: process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY,
  cohere: process.env.COHERE_API_KEY,
  huggingface: process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY,
  zai: process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY,
  'openai-images': process.env.OPENAI_API_KEY,
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'NexusAI',
    version: '1.0.0',
    ts: Date.now(),
    envKeys: Object.entries(ENV_KEYS)
      .filter(([, v]) => !!v)
      .map(([k]) => k),
  });
});

app.get('/api/providers', (_req, res) => {
  res.json(serializeProviders());
});

// GET /api/fetch?url=… — LIVE page fetching for the Researcher agent.
// Reads any http(s) page server-side (no CORS limits on self-hosted
// instances), strips it to readable text and returns it.
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

app.post('/api/generate', async (req, res) => {
  const { prompt, model, w, h, seed } = req.body || {};
  if (!String(prompt || '').trim()) return res.status(400).json({ ok: false, error: 'prompt required' });
  try {
    const out = await engineGenerate(
      { prompt: String(prompt), model: model ? String(model) : undefined, w: Number(w) || 1024, h: Number(h) || 1024, seed: seed != null ? Number(seed) : Math.floor(Math.random() * 1e9) },
      fetch
    );
    res.json({ ok: true, b64: out.b64, model: out.model, contentType: out.contentType, cached: out.cached, requested: out.requested, fellBack: !!out.fellBack });
  } catch (e) {
    res.status(502).json({ ok: false, error: e?.message || 'generation failed' });
  }
});

app.get('/api/fetch', async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'http(s) URL required' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NexusAI-Researcher/1.0)', accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' },
      redirect: 'follow',
    });
    const ct = r.headers.get('content-type') || '';
    const raw = await r.text();
    const text = /json/i.test(ct) ? raw.slice(0, 16000) : htmlToText(raw);
    res.json({ ok: r.ok, status: r.status, url, contentType: ct, text: text.slice(0, 12000) });
  } catch (e) {
    res.status(502).json({ error: `fetch failed: ${e?.message || e}` });
  } finally {
    clearTimeout(timer);
  }
});

// POST /api/proxy — body: { provider, apiKey?, body }  (body is provider-native)
app.post('/api/proxy', async (req, res) => {
  const { provider, apiKey, body } = req.body || {};
  const stream = body?.stream !== false;

  if (provider === 'demo') {
    try {
      if (stream) return streamDemo(body, res);
      const text = await demoResponse(body);
      return res.json({ choices: [{ message: { role: 'assistant', content: text } }] });
    } catch (e) {
      return res.status(500).json({ error: { message: e.message } });
    }
  }

  const reg =
    PROVIDERS.find((p) => p.id === provider) ||
    IMAGE_PROVIDERS.find((p) => p.id === provider);
  if (!reg) return res.status(400).json({ error: { message: `Unknown provider "${provider}"` } });

  const key = (apiKey || ENV_KEYS[reg.keyRef || provider] || '').trim();
  if (reg.needsKey && !key) {
    return res.status(400).json({
      error: { message: `No API key set for ${reg.name}. Add one in Keys & Models, or set ${provider.toUpperCase()}_API_KEY on the server.` },
    });
  }

  const url = reg.url ? reg.url(key) : reg.baseUrl;
  const headers = { 'Content-Type': 'application/json', ...(reg.headers ? reg.headers(key) : {}) };

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!upstream.ok) {
      const raw = await upstream.text();
      let msg = raw;
      try {
        const j = JSON.parse(raw);
        msg = j?.error?.message || j?.error?.type || j?.message || raw;
      } catch {}
      return res.status(upstream.status).json({ error: { message: msg, status: upstream.status } });
    }
    if (!stream) {
      const j = await upstream.json();
      return res.json(j);
    }
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const reader = upstream.body.getReader();
    req.on('close', () => {
      try { reader.cancel(); } catch {}
    });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {}
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: `NexusAI server could not reach ${reg.name} (${e.message}). If you are inside a sandboxed preview, run NexusAI locally or use a direct-capable provider (Pollinations / OpenRouter / Claude).`,
          network: true,
        },
      });
    } else {
      try { res.end(); } catch {}
    }
  }
});

// Static frontend — cache strategy that prevents "stale HTML → 404 asset":
//   /assets/*  → content-hashed filenames, safe to cache immutably forever
//   index.html → never cached, so every deploy is picked up instantly
app.use(
  express.static(DIST, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api')) {
    const index = path.join(DIST, 'index.html');
    if (fs.existsSync(index)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(index);
    }
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(``);
  console.log(`  ⬡ NexusAI server online  →  http://0.0.0.0:${PORT}`);
  console.log(`  ⬡ API proxy ready        →  POST /api/proxy`);
  console.log(`  ⬡ Env keys detected      →  ${Object.keys(ENV_KEYS).filter((k) => ENV_KEYS[k]).join(', ') || 'none'}`);
  console.log(``);
});
