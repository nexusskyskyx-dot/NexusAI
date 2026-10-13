// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Image Engine (server) — the best models, free, with escalation
// ─────────────────────────────────────────────────────────────────────────────
// Flow (v1.20):  Frontend → POST /api/generate → this engine → Pollinations
// relay (keyless) → flagship image model → back to the user. If the best model
// is unavailable, the call is FORCED down the ladder until one produces.
//
// The relay currently serves flagship-class models keylessly (FLUX 2 Pro,
// Gemini 3.1 Flash Image, GPT-Image 2.5, Grok Imagine) — this engine always
// tries the best first and never dead-ends. Results are cached on disk so
// identical requests (same prompt+seed+size+model) are instant and offline.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.cache', 'imgengine');
const MAX_CACHE_FILES = 300;

// best → fastest-free. The requested model is tried first, then this ladder.
export const LADDER = [
  'black-forest-labs/flux.2-pro', // flagship
  'google/gemini-3.1-flash-image', // flagship, fast
  'black-forest-labs/flux.1-schnell', // free workhorse
  'tongyu-mai/z-image-turbo', // relay default
];

export function buildUrl({ prompt, model, w, h, seed }) {
  const p = encodeURIComponent(String(prompt).slice(0, 900));
  const q = new URLSearchParams({
    width: String(w || 1024),
    height: String(h || 1024),
    model: String(model || LADDER[0]),
    seed: String(seed ?? 0),
    nologo: 'true',
    referrer: 'nexusai',
  });
  return `https://image.pollinations.ai/prompt/${p}?${q}`;
}

export function cacheKey(params) {
  return crypto.createHash('sha1').update(JSON.stringify({
    p: String(params.prompt || '').slice(0, 900),
    m: params.model,
    w: params.w || 1024,
    h: params.h || 1024,
    s: params.seed ?? 0,
  })).digest('hex');
}

function files() {
  try {
    return fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.bin'));
  } catch {
    return [];
  }
}

export function cacheGet(params) {
  const key = cacheKey(params);
  try {
    const buf = fs.readFileSync(path.join(CACHE_DIR, key + '.bin'));
    const meta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, key + '.meta'), 'utf8'));
    return { b64: buf.toString('base64'), model: meta.model, contentType: meta.contentType };
  } catch {
    return null;
  }
}

export function cachePut(params, buffer, contentType, model) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const key = cacheKey(params);
    fs.writeFileSync(path.join(CACHE_DIR, key + '.bin'), buffer);
    fs.writeFileSync(path.join(CACHE_DIR, key + '.meta'), JSON.stringify({ model, contentType, ts: Date.now() }));
    // LRU sweep — keep the cache bounded
    const bins = files();
    if (bins.length > MAX_CACHE_FILES) {
      const metas = bins
        .map((f) => {
          const full = path.join(CACHE_DIR, f);
          let ts = 0;
          try { ts = fs.statSync(full).mtimeMs; } catch {}
          return { full, stem: f.replace(/\.bin$/, ''), ts };
        })
        .sort((a, b) => a.ts - b.ts);
      for (const old of metas.slice(0, bins.length - MAX_CACHE_FILES)) {
        try {
          fs.unlinkSync(old.full);
          fs.unlinkSync(path.join(CACHE_DIR, old.stem + '.meta'));
        } catch {}
      }
    }
  } catch {}
}

function fetchWithTimeout(fetchImpl, url, ms) {
  return new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new Error('timeout')), ms);
    fetchImpl(url, { signal: ctl.signal })
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

// generateImage(params, fetchImpl) → { b64, model, contentType, cached }
// Escalates: requested model → ladder. Cache is checked per model before
// any network call. Throws only after EVERY rung failed.
export async function generateImage({ prompt, model, w, h, seed }, fetchImpl = fetch) {
  const params = { prompt: String(prompt || ''), w, h, seed };
  const order = model && !LADDER.includes(model) ? [model, ...LADDER] : model ? [model, ...LADDER.filter((m) => m !== model)] : [...LADDER];
  const errors = [];

  for (const m of order) {
    const hit = cacheGet({ ...params, model: m });
    if (hit) return { ...hit, cached: true };

    try {
      const r = await fetchWithTimeout(fetchImpl, buildUrl({ ...params, model: m }), 100_000);
      if (!r.ok) {
        errors.push(`${m}: HTTP ${r.status}`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || '';
      if (!ct.startsWith('image/') || buf.length < 1000) {
        errors.push(`${m}: not an image (${ct || 'no type'}, ${buf.length}B)`);
        continue;
      }
      cachePut({ ...params, model: m }, buf, ct, m);
      return { b64: buf.toString('base64'), model: m, contentType: ct, cached: false };
    } catch (e) {
      errors.push(`${m}: ${e?.message || 'failed'}`);
    }
  }
  throw new Error(errors.join(' | ') || 'generation failed');
}
