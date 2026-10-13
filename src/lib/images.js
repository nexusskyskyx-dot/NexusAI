// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Image generation
// Pollinations (free, no key, straight from the browser) and OpenAI images
// (DALL·E 3 / GPT-Image 1 via the local server proxy).
// ─────────────────────────────────────────────────────────────────────────────
import { getImageProvider, IMAGE_PROVIDERS } from '@shared/providers.js';

export const IMAGE_ASPECTS = [
  { id: '1:1', label: 'Square', w: 1024, h: 1024 },
  { id: '16:9', label: 'Landscape', w: 1280, h: 720 },
  { id: '9:16', label: 'Portrait', w: 768, h: 1344 },
];

const OPENAI_SIZES = {
  'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
  'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536'],
  'dall-e-2': ['1024x1024', '512x512'],
};

function aspectIndex(aspectId) {
  if (aspectId === '16:9') return 1;
  if (aspectId === '9:16') return 2;
  return 0;
}

export function imageApiKey(providerId, keys = {}) {
  const p = getImageProvider(providerId);
  if (!p) return '';
  return keys[p.keyRef || providerId] || '';
}

export function pollinationsUrl({ prompt, model, w, h, seed }) {
  const p = encodeURIComponent(String(prompt || '').slice(0, 900));
  const q = new URLSearchParams({
    width: String(w),
    height: String(h),
    model: model || 'flux',
    seed: String(seed),
    nologo: 'true',
    referrer: 'nexusai',
  });
  return `https://image.pollinations.ai/prompt/${p}?${q}`;
}

// generateImage → { src, w, h, seed, model, provider, prompt, remote? }
// src is a blob:/object URL when possible (canvas-editor safe) or the remote URL.
export async function generateImage({ provider, model, prompt, w = 1024, h = 1024, aspect, apiKey, signal }) {
  const reg = getImageProvider(provider);
  if (!reg) throw new Error(`Unknown image provider "${provider}"`);

  if (aspect) {
    const a = IMAGE_ASPECTS.find((x) => x.id === aspect) || IMAGE_ASPECTS[0];
    w = a.w;
    h = a.h;
  }
  const seed = Math.floor(Math.random() * 1e9);

  if (reg.kind === 'pollinations-image') {
    const url = pollinationsUrl({ prompt, model, w, h, seed });
    // Fetch as a blob so the editor canvas stays untainted; fall back to the
    // raw URL if the fetch is blocked (the <img> tag can still load it).
    try {
      const r = await fetch(url, { signal, mode: 'cors' });
      if (!r.ok) throw new Error(`Pollinations returned HTTP ${r.status}`);
      const blob = await r.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Pollinations did not return an image (rate limited?)');
      return { src: URL.createObjectURL(blob), w, h, seed, model: model || 'flux', provider, prompt, remote: false };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return { src: url, w, h, seed, model: model || 'flux', provider, prompt, remote: true };
    }
  }

  if (reg.kind === 'gemini-image') {
    // native Gemini image generation (Nano Banana family) with an AI Studio key.
    // Self-healing: Google retires image models regularly (gemini-2.5-flash-image
    // died Oct 2026) — on a 404 we walk the provider's model list until one answers.
    const key = apiKey || '';
    if (!key) throw new Error('Gemini Image needs a Google AI Studio key (free) — add it in Keys');
    // Gemini-supported aspect ratios; our 16:9/9:16 map to the closest natives
    const ASPECT_MAP = { '1:1': '1:1', '16:9': '3:2', '9:16': '2:3' };
    const ladder = [model, ...(reg.models || []).map((m) => m.id).filter((m) => m !== model)];
    const wanted = model;
    let lastErr = null;
    for (const m of ladder) {
      const r = await fetch(`${reg.baseUrl}/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: String(prompt).slice(0, 1800) }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(ASPECT_MAP[aspect] ? { imageConfig: { aspectRatio: ASPECT_MAP[aspect] } } : {}),
          },
        }),
        signal,
      }).catch((e) => {
        if (e?.name === 'AbortError') throw e;
        throw new Error(`Gemini Image unreachable (${e?.message || 'network'})`);
      });
      if (r.status === 404) {
        lastErr = new Error(`${m} is not available (HTTP 404 — retired or unknown model)`);
        continue; // try the next model in the family
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Gemini Image error (HTTP ${r.status})`);
      const part = (j?.candidates?.[0]?.content?.parts || []).find((x) => x?.inlineData?.data);
      if (!part) throw new Error(j?.candidates?.[0]?.content?.parts?.[0]?.text || 'Gemini returned no image (safety filter or quota?)');
      const a = IMAGE_ASPECTS.find((x) => x.id === aspect) || IMAGE_ASPECTS[0];
      return {
        src: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
        w: a.w, h: a.h, seed, model: m, provider, prompt, remote: false,
        requestedModel: wanted, fellBack: m !== wanted,
      };
    }
    throw lastErr || new Error('Gemini Image: no available model');
  }

  if (reg.kind === 'server-image') {
    // v1.20 · the NexusAI server engine — forced flagship escalation + cache
    const r = await fetch(reg.baseUrl || '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: String(prompt).slice(0, 900), model, w, h, seed }),
      signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok || !j?.b64) throw new Error(j?.error || `NexusAI Engine error (HTTP ${r.status})`);
    return {
      src: `data:${j.contentType || 'image/jpeg'};base64,${j.b64}`,
      w, h, seed, model: j.model, provider, prompt, remote: false,
      requestedModel: j.requested || model, fellBack: !!j.fellBack && j.model !== (j.requested || model),
    };
  }

  if (reg.kind === 'openai-images') {
    const sizes = OPENAI_SIZES[model] || OPENAI_SIZES['dall-e-3'];
    const size = sizes[aspectIndex(aspect)] || sizes[0];
    const body = { model, prompt: String(prompt).slice(0, 3800), n: 1, size };
    if (model.startsWith('dall-e')) body.response_format = 'b64_json'; // signed URLs expire — b64 is durable
    const r = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai-images', apiKey, body }),
      signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `OpenAI images error (HTTP ${r.status})`);
    const d = j?.data?.[0];
    if (!d) throw new Error('OpenAI returned no image data');
    const src = d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url;
    const [sw, sh] = size.split('x').map(Number);
    return { src, w: sw, h: sh, seed, model, provider, prompt, remote: !d.b64_json };
  }

  throw new Error(`Image provider kind "${reg.kind}" is not supported`);
}

// ── durability (v1.16.1): images must survive reloads, quota strips, expiry ──

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('load failed'));
    im.src = src;
  });
}

// durable(img) → { data } — a compressed JPEG data-URL snapshot that survives
// page reloads (blob: URLs die with the session) and storage for years.
// Browser-only; returns {} when canvas isn't available (Node, SSR) or the
// source is cross-origin-tainted — the regen recipe covers those cases.
export async function durable(img) {
  if (typeof document === 'undefined') return {};
  const src = img?.src;
  if (!src || /^(https?:)/i.test(src)) return {}; // remote → regen recipe instead
  try {
    const image = await loadImg(src);
    const MAX = 896;
    const scale = Math.min(1, MAX / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(image.naturalWidth * scale));
    c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.8) };
  } catch {
    return {};
  }
}

// regenFor(img, prompt) → deterministic re-fetch recipe. Pollinations URLs are
// a pure function of (prompt, model, w, h, seed) — same recipe, same image.
export function regenFor(img, prompt) {
  if (!img) return null;
  const rec = {
    provider: img.provider,
    model: img.model,
    prompt: String(prompt || img.prompt || '').slice(0, 900),
    w: img.w,
    h: img.h,
    seed: img.seed,
  };
  if (rec.provider === 'pollinations' && rec.model && rec.prompt && rec.w && rec.h && rec.seed != null) {
    rec.url = pollinationsUrl({ prompt: rec.prompt, model: rec.model, w: rec.w, h: rec.h, seed: rec.seed });
  }
  return rec;
}

// recoverChain(im) → ordered candidate srcs: live src → durable data → regen URL.
// Walk it on <img> onError until something loads; the expired card is the last
// resort, never the first response.
export function recoverChain(im) {
  const chain = [];
  if (typeof im?.src === 'string' && im.src) chain.push(im.src); // live src first (blob alive in-session)
  if (typeof im?.data === 'string' && im.data.startsWith('data:')) chain.push(im.data);
  if (im?.regen?.url) chain.push(im.regen.url);
  return [...new Set(chain)];
}

// friendly label for any image model id ('black-forest-labs/flux.1-schnell' → 'FLUX schnell')
export function imageModelLabel(modelId) {
  for (const p of IMAGE_PROVIDERS) {
    const m = (p.models || []).find((x) => x.id === modelId);
    if (m) return m.label;
  }
  return String(modelId || '').split('/').pop();
}
