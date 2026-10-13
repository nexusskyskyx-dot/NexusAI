// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Auto-Best — when keys arrive, pick the best models automatically
// ─────────────────────────────────────────────────────────────────────────────
// Philosophy: never leave a slot on a default/free model when a better model
// just became available — but never clobber a deliberate pick that still works.
//
//   autoConfigure(state) → { solo, squad, prj, image, changes: ['…'] }
//   changes is a human-readable list for the toast.
//
// Rules per slot:
//   · slot empty / on the free default (pollinations / demo) → upgrade to best
//   · slot's provider lost its credential → remap to best available
//   · slot on a working keyed provider → untouched (user chose it)

import { getModel, getProvider } from '@shared/providers.js';

// local credential check (avoids a store ↔ autobest import cycle);
// keyless providers (Pollinations, demo) are always available
const hasCredential = (pid, s) => {
  const p = getProvider(pid);
  if (p && !p.needsKey) return true;
  return !!(s.keys && s.keys[pid]) || (s.envKeys || []).includes(pid);
};

// preference ladders — first available (key present + model exists) wins.
// Free tiers rank above paid per tier; within a tier, smarter > faster for
// chat, code-tuned models for coding slots.
const LADDERS = {
  chat: [
    ['gemini', 'gemini-3-flash'],
    ['xkiro', 'mistralai/mistral-large-4-0'],
    ['openrouter', 'deepseek/deepseek-chat-v3-0324:free'],
    ['groq', 'llama-3.3-70b-versatile'],
    ['github', 'openai/gpt-4o'],
    ['openrouter', 'qwen/qwen3-235b-a22b:free'],
    ['zai', 'glm-4.7-flash'],
    ['cerebras', 'llama-3.3-70b'],
    ['mistral', 'mistral-small-latest'],
    ['nvidia', 'openai/gpt-oss-120b'],
    ['cohere', 'command-a-03-2025'],
    ['huggingface', 'openai/gpt-oss-120b'],
    ['openai', 'gpt-4o-mini'],
    ['qwen', 'qwen-plus'],
    ['deepseek', 'deepseek-chat'],
    ['pollinations', 'openai'],
  ],
  code: [
    ['xkiro', 'qwen/qwen3-coder-plus:free'],
    ['openrouter', 'qwen/qwen3-coder:free'],
    ['xkiro', 'mistralai/codestral-2508'],
    ['groq', 'openai/gpt-oss-120b'],
    ['github', 'openai/gpt-4.1'],
    ['nvidia', 'qwen/qwen2.5-coder-32b-instruct'],
    ['zai', 'glm-4.7-flash'],
    ['cerebras', 'qwen-3-32b'],
    ['openrouter', 'deepseek/deepseek-chat-v3-0324:free'],
    ['deepseek', 'deepseek-chat'],
    ['qwen', 'qwen3-coder-plus'],
    ['gemini', 'gemini-3-flash'],
    ['openai', 'gpt-4o-mini'],
    ['pollinations', 'qwen-coder'],
  ],
  plan: [
    ['gemini', 'gemini-3-flash'],
    ['xkiro', 'qwen/qwen3.7-flash:free'],
    ['groq', 'llama-3.3-70b-versatile'],
    ['openrouter', 'deepseek/deepseek-chat-v3-0324:free'],
    ['github', 'openai/gpt-4o-mini'],
    ['zai', 'glm-4.5-flash'],
    ['mistral', 'mistral-small-latest'],
    ['cerebras', 'llama-3.3-70b'],
    ['nvidia', 'openai/gpt-oss-120b'],
    ['cohere', 'command-r7b-12-2024'],
    ['pollinations', 'mistral'],
  ],
};

function bestIn(ladder, s) {
  for (const [provider, model] of ladder) {
    if (!hasCredential(provider, s)) continue;
    if (s.laneHealth?.[provider] === 'dead') continue; // free tier died — skip it
    if (!getModel(provider, model)) continue;
    return { provider, model };
  }
  return null;
}

const isDefault = (slot) => !slot || slot.provider === 'pollinations' || slot.provider === 'demo';
const usable = (slot, s) => slot && slot.model && getModel(slot.provider, slot.model) && hasCredential(slot.provider, s);

function pick(slot, ladder, s, label, changes) {
  if (usable(slot, s) && !isDefault(slot)) return slot; // deliberate pick, still works
  const best = bestIn(ladder, s) || slot;
  if (best && (slot?.provider !== best.provider || slot?.model !== best.model)) {
    changes.push(`${label} → ${best.provider === 'pollinations' ? 'Pollinations' : best.provider}`);
    return best;
  }
  return slot;
}

export function autoConfigure(s) {
  const changes = [];

  const solo = pick(s.solo, LADDERS.chat, s, 'Chat', changes);

  const sq = s.squad || {};
  const workers = (sq.workers || []).map((w, i) => pick(w, LADDERS.code, s, `Drafter ${i + 1}`, changes));
  const planner = pick(sq.planner, LADDERS.plan, s, 'Planner', changes);
  const critic = pick(sq.critic, LADDERS.chat, s, 'Reviewer', changes);
  const synth = pick(sq.synth, LADDERS.chat, s, 'Synthesizer', changes);
  const squad = { ...sq, workers, planner, critic, synth };

  const prj = pick(s.prj, LADDERS.code, s, 'Projects', changes);

  // image: the best painter the user can actually run — DALL·E when the OpenAI
  // key exists (explicitly requested), otherwise free Flux.
  let image = s.image || {};
  const wantsOpenAI = hasCredential('openai', s);
  const onDefault = !image.provider || image.provider === 'pollinations' || image.provider === 'nexus-engine'; // engine is OUR default, not a user pick
  const wantsGemini = hasCredential('gemini', s);
  if (wantsOpenAI && onDefault) {
    image = { ...image, provider: 'openai-images', model: 'dall-e-3' };
    changes.push('Images → DALL·E 3');
  } else if (!wantsOpenAI && wantsGemini && (onDefault || image.provider === 'openai-images')) {
    image = { ...image, provider: 'gemini-image', model: 'gemini-3.1-flash-image' };
    changes.push('Images → Gemini 2.5 Flash Image');
  } else if (!wantsOpenAI && !wantsGemini && image.provider === 'openai-images') {
    image = { ...image, provider: 'nexus-engine', model: 'black-forest-labs/flux.2-pro' };
    changes.push('Images → FLUX 2 Pro (engine)');
  } else if (onDefault) {
    image = { ...image, provider: wantsGemini ? 'gemini-image' : 'nexus-engine', model: wantsGemini ? 'gemini-3.1-flash-image' : 'black-forest-labs/flux.2-pro' };
  }

  return { solo, squad, prj, image, changes };
}
