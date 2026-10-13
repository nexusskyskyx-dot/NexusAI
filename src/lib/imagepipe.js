// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Image Team — a five-agent pipeline for better images
// ─────────────────────────────────────────────────────────────────────────────
//   1 · Websearcher   — looks up what the subject actually looks like
//   2 · Prompt Enhancer — rewrites the idea into a rich, model-ready prompt
//   3 · Image Tools   — generates the image (Pollinations / DALL·E)
//   4 · Upscaler      — canvas unsharp mask + grade for crisp output
//   5 · Previewer     — deterministic pass/fail check, one retry on fail
//
// Every stage is injectable (`search`, `complete`, `generate`, `upscale`,
// `check`) so the pipeline can be tested end-to-end without a browser.

import { completeChat } from '@lib/ai.js';
import { searchWeb } from '@lib/websearch.js';
import { generateImage as defaultGenerate } from '@lib/images.js';

const ENHANCER_SYSTEM = `You are a world-class prompt engineer for AI image generation.
Rewrite the user's idea into ONE rich image prompt: subject with specifics, action/pose, environment, lighting, color mood, composition, art style or camera lens, quality descriptors.
Keep every concrete detail the user asked for. 40-90 words. Output ONLY the prompt — no preamble, no quotes, no lists.`;

// ── 1 · Websearcher ──────────────────────────────────────────────────────────
async function defaultSearch(prompt, { signal } = {}) {
  try {
    const w = await searchWeb(`${prompt} visual appearance description`, { signal });
    if (w?.ok && w.knowledge) {
      // compact visual facts only — the enhancer doesn't need citations
      const facts = w.knowledge
        .split('\n')
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('**'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, 600);
      if (facts.length > 60) return facts;
    }
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  return '';
}

// ── 2 · Prompt Enhancer ──────────────────────────────────────────────────────
// Fast free model first (keyless Pollinations); deterministic fallback always.
async function defaultComplete({ system, user, signal }) {
  return completeChat({
    provider: 'pollinations',
    model: 'openai',
    messages: [{ role: 'user', content: user }],
    system,
    maxTokens: 260,
    signal,
  });
}

export function enhanceDeterministic(prompt, facts) {
  const p = String(prompt || '').trim().replace(/\s+/g, ' ');
  const bits = [
    p,
    facts ? `inspired by real reference: ${facts}` : '',
    'highly detailed, dramatic lighting, rich color grading, sharp focus, cinematic composition, masterpiece quality',
  ].filter(Boolean);
  return bits.join(' — ').slice(0, 800);
}

function cleanEnhanced(text, original) {
  const t = String(text || '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(prompt|image prompt|here('s| is)[^:]*:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length < 12) return null;
  // keep it a prompt, not an essay
  return t.slice(0, 900);
}

// ── 4 · Upscaler — canvas unsharp mask + gentle grade (browser only) ────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function unsharpMask(ctx, w, h, amount = 0.6) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const d = out.data;
  // 3×3 box blur, then out = orig + amount*(orig - blur)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
            sum += s[(yy * w + xx) * 4 + c];
            n++;
          }
        }
        const blur = sum / n;
        let v = s[i + c] + amount * (s[i + c] - blur);
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

async function defaultUpscale(img) {
  // cross-origin remote fallbacks can't be read — skip them cleanly
  if (img.remote || img.src?.startsWith('http')) return { ...img, upscaled: false };
  if (typeof document === 'undefined') return { ...img, upscaled: false };
  try {
    const image = await loadImage(img.src);
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.filter = 'saturate(1.06) contrast(1.04)';
    ctx.drawImage(image, 0, 0);
    ctx.filter = 'none';
    unsharpMask(ctx, c.width, c.height, 0.6);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return { ...img, upscaled: false };
    return { ...img, src: URL.createObjectURL(blob), upscaled: true };
  } catch {
    return { ...img, upscaled: false };
  }
}

// ── 5 · Previewer — deterministic pass/fail ──────────────────────────────────
async function defaultCheck(img, { aspectW, aspectH } = {}) {
  if ((img.w || 0) < 512 && (img.h || 0) < 512) return { pass: false, why: 'too small' };
  if (aspectW && aspectH && img.w && img.h) {
    const want = aspectW / aspectH;
    const got = img.w / img.h;
    if (Math.abs(want - got) / want > 0.08) return { pass: false, why: 'wrong aspect' };
  }
  // blank/solid-frame detection: downscale to 32×32 and measure luma spread
  if (typeof document === 'undefined') return { pass: true, why: 'node' };
  try {
    const image = await loadImage(img.src);
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 32, 32);
    const px = ctx.getImageData(0, 0, 32, 32).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (luma < min) min = luma;
      if (luma > max) max = luma;
    }
    if (max - min < 8) return { pass: false, why: 'blank frame' };
  } catch {
    return { pass: true, why: 'unchecked (remote)' };
  }
  return { pass: true, why: 'ok' };
}

// ── the pipeline ─────────────────────────────────────────────────────────────
// runImagePipeline(opts) → { images, enhancedPrompt, enhancedBy, stages, warns }
export async function runImagePipeline({
  prompt,
  provider = 'pollinations',
  model = 'flux',
  aspect = '1:1',
  aspectW,
  aspectH,
  count = 1,
  apiKey,
  signal,
  web = true,
  onStage = () => {},
  search = defaultSearch,
  complete = defaultComplete,
  generate = defaultGenerate,
  upscale = defaultUpscale,
  check = defaultCheck,
}) {
  const stages = [];
  const stage = (stageId, status, detail) => {
    stages.push({ stage: stageId, status, detail });
    onStage(stageId, status, detail);
  };
  const guard = () => {
    if (signal?.aborted) throw new Error('aborted');
  };
  const warns = [];

  // 1 · Websearcher
  let facts = '';
  if (web) {
    stage('research', 'run', 'visual references');
    facts = await search(prompt, { signal });
    guard();
    stage('research', facts ? 'done' : 'skip', facts ? 'visual facts found' : 'nothing useful — continuing');
  } else {
    stage('research', 'skip', 'web off');
  }

  // 2 · Prompt Enhancer
  stage('enhance', 'run', 'rewriting the prompt');
  let enhancedPrompt = '';
  let enhancedBy = 'none';
  try {
    const raw = await complete({
      system: ENHANCER_SYSTEM,
      user: `User's idea: ${String(prompt).slice(0, 600)}${facts ? `\n\nVisual facts from the web:\n${facts}` : ''}`,
      signal,
    });
    const cleaned = cleanEnhanced(raw, prompt);
    if (cleaned) {
      enhancedPrompt = cleaned;
      enhancedBy = 'model';
    }
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  if (!enhancedPrompt) {
    enhancedPrompt = enhanceDeterministic(prompt, facts);
    enhancedBy = 'deterministic';
  }
  guard();
  stage('enhance', 'done', enhancedBy === 'model' ? 'model-rewritten prompt' : 'rule-based boost');

  // 3-5 · Image Tools → Upscaler → Previewer (one retry on fail)
  const finalPrompt = enhancedPrompt || prompt;
  const images = [];
  const n = Math.max(1, Math.min(4, count || 1));
  for (let i = 0; i < n; i++) {
    guard();
    stage('generate', 'run', `image ${i + 1}/${n}`);
    let img = null;
    try {
      img = await generate({ prompt: finalPrompt, provider, model, aspect, apiKey, signal, i });
    } catch (e) {
      if (e?.name === 'AbortError' || e === 'aborted') throw e;
      stage('generate', 'fail', e?.message || 'generation failed');
      warns.push(`image ${i + 1}: ${e?.message || 'generation failed'}`);
      continue;
    }
    stage('generate', 'done', `image ${i + 1}/${n}`);

    guard();
    stage('upscale', 'run', 'unsharp mask');
    img = await upscale(img);
    stage('upscale', img.upscaled === false ? 'skip' : 'done', img.upscaled === false ? 'not canvas-safe' : 'sharpened');

    guard();
    stage('check', 'run', 'pass/fail');
    let verdict = await check(img, { aspectW, aspectH });
    if (!verdict?.pass) {
      // one retry — fresh seed, same enhanced prompt
      stage('check', 'retry', verdict?.why || 'failed');
      try {
        img = await generate({ prompt: finalPrompt, provider, model, aspect, apiKey, signal, i, retry: true });
        img = await upscale(img);
        verdict = await check(img, { aspectW, aspectH });
      } catch (e) {
        if (e?.name === 'AbortError' || e === 'aborted') throw e;
        verdict = { pass: false, why: e?.message || 'retry failed' };
      }
    }
    if (verdict?.pass) {
      images.push({ ...img, check: 'pass' });
      stage('check', 'done', 'passed');
    } else {
      stage('check', 'fail', verdict?.why || 'failed twice');
      warns.push(`image ${i + 1}: ${verdict?.why || 'failed quality check twice'}`);
    }
  }

  return { images, enhancedPrompt, enhancedBy, stages, warns };
}
