// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Image generation
// Pollinations (free, no key, straight from the browser) and OpenAI images
// (DALL·E 3 / GPT-Image 1 via the local server proxy).
// ─────────────────────────────────────────────────────────────────────────────
import { getImageProvider } from '@shared/providers.js';

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

  if (reg.kind === 'openai-images') {
    const sizes = OPENAI_SIZES[model] || OPENAI_SIZES['dall-e-3'];
    const size = sizes[aspectIndex(aspect)] || sizes[0];
    const body = { model, prompt: String(prompt).slice(0, 3800), n: 1, size };
    if (model.startsWith('dall-e')) body.response_format = 'url';
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
