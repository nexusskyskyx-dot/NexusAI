// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Multi-Agent Engine ("the Team") — with automatic failover
//
//   ┌─────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐    ┌─────────┐
//   │ PLANNER │ →  │ DRAFTER A│ │ DRAFTER B│ │ DRAFTER C│ →  │ REVIEW  │
//   └─────────┘    └──────────┘ └──────────┘ └──────────┘    └────┬────┘
//        brief      parallel drafts (different models)      verdict │
//   ┌──────────────┐                                            ▼
//   │ SYNTHESIZER  │ ← best draft + review notes + brief → final answer
//   └──────────────┘
//
// If an agent's model fails (bad key, rate limit, outage), the engine
// automatically switches that agent to the next available model from the
// fallback pool — the user just sees "switched to X" on the agent card.
// ─────────────────────────────────────────────────────────────────────────────
import { streamChat, ApiError, friendlyError } from './ai.js';
import { modelLabel } from '@shared/providers.js';
import { searchWeb, researchQuery } from './websearch.js';

const ROLE_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function trimHistory(messages, maxMessages = 12, maxChars = 6000) {
  const recent = messages.slice(-maxMessages);
  return recent.map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, maxChars),
  }));
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return String(messages[i].content || '');
  return '';
}

export const SYSTEMS = {
  solo: `You are NexusAI — an elite AI assistant built from a coalition of frontier models (DeepSeek, Qwen, Claude, GPT). You are precise, bold and complete.
- Lead with the answer, then the detail.
- Use rich Markdown: headings, tight bullet lists, bold key terms, tables when useful.
- When code helps, give complete runnable code in fenced blocks with a language tag.
- No filler, no disclaimers you don't need. Maximum signal.`,

  planner: `You are the PLANNER agent inside the NexusAI multi-agent team. Your job is to write a short creative brief that a group of drafting agents will follow to answer the user.
Output EXACTLY these sections, under 150 words total:
## Goal
## Requirements
## Approach
## Style
Do NOT answer the request yourself. Just brief the team.`,

  worker: (letter, model) => `You are DRAFTER ${letter} (running as ${model}) on the NexusAI team. Follow the team brief and write the complete, best-possible answer to the user NOW.
- This is a competition between drafts: be the one worth shipping.
- Rich Markdown, complete code with language tags when relevant.
- Answer directly — never mention the brief, the team, or that you are a drafter.`,

  critic: `You are the REVIEW agent of the NexusAI team. Several drafters answered the user independently. Compare them and output:
## Verdict
Which draft (A, B, C...) is strongest and why — 2 to 4 sentences.
## Merge
Bullet list: what to KEEP from each draft, what to FIX, what to ADD.
Be concrete and decisive. Do not write the final answer.`,

  synth: `You are the SYNTHESIS agent of the NexusAI team — you write the FINAL answer the user sees.
Rules:
- Use the best draft as your base and apply the review notes: keep the strongest parts, fix weaknesses, add what was missing.
- Output ONLY the final answer in rich Markdown. No meta commentary about drafts, reviews or agents.
- If code is involved, ship complete, runnable code in fenced blocks with language tags.`,
};

// ── failover helpers ─────────────────────────────────────────────────────────
const slotKey = (s) => `${s?.provider}/${s?.model}`;

// Build an attempt list: the assigned slot first, then unused pool models.
function buildAttempts(slot, pool, used, max) {
  const attempts = [slot];
  const seen = new Set(used.map(slotKey));
  seen.add(slotKey(slot));
  for (const cand of pool || []) {
    if (attempts.length >= max) break;
    if (!cand || !cand.model || seen.has(slotKey(cand))) continue;
    seen.add(slotKey(cand));
    attempts.push({ provider: cand.provider, model: cand.model });
  }
  return attempts;
}

// Run one agent; returns {text, reasoning, error, ms}
async function runAgent({ provider, model, system, messages, apiKey, temperature, maxTokens, signal, onDelta, onReasoning, staggerMs, transport }) {
  const t0 = performance.now();
  if (staggerMs) await new Promise((r) => setTimeout(r, staggerMs));
  if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  const { text, reasoning } = await streamChat({
    provider,
    model,
    messages,
    system,
    temperature,
    maxTokens,
    apiKey,
    signal,
    transport,
    onDelta,
    onReasoning,
  });
  return { text, reasoning, ms: Math.round(performance.now() - t0) };
}

// Run with automatic failover across the attempt list.
// onSwitch(provider, model) fires before a retry so the UI can relabel the agent.
// keyOf(provider) resolves the key per attempt (it may change after a switch).
async function runResilient({ attempts, used, keyOf, ...params }) {
  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    const slot = attempts[i];
    used.push(slot);
    try {
      const r = await runAgent({ ...params, ...slot, apiKey: keyOf ? keyOf(slot.provider) : params.apiKey });
      return { ...r, provider: slot.provider, model: slot.model, switched: i > 0, failedAttempts: i };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (i < attempts.length - 1) {
        params.onSwitch?.(attempts[i + 1], friendlyError(e));
      }
    }
  }
  throw lastErr;
}

function parseVerdict(review) {
  const m = String(review).match(/##\s*Verdict[\s\S]{0,400}?\b([A-E])\b/);
  return m ? m[1] : null;
}

// ── TEAM RUN ─────────────────────────────────────────────────────────────────
// cfg: { workers:[{provider,model}], planner:{provider,model}|null,
//        critic:{provider,model}|null, synth:{provider,model},
//        pool:[{provider,model}] (ordered fallbacks), settings, keys, transport }
// cb:   { onStage, onAgent(agent), onFinalDelta, onFinalReasoning }
export async function runTeam({ messages, cfg, cb, signal }) {
  const keys = cfg.keys || {};
  const s = cfg.settings || {};
  const temp = typeof s.temperature === 'number' ? s.temperature : 0.7;
  const transport = s.transport || 'auto';
  const history = trimHistory(messages);
  const userText = lastUserText(messages);
  const pool = cfg.pool || [];

  const agents = [];
  const emitAgent = (a) => {
    const i = agents.findIndex((x) => x.id === a.id);
    if (i >= 0) agents[i] = a;
    else agents.push(a);
    cb.onAgent?.({ ...a });
  };

  const key = (p) => keys[p] || '';
  const mk = (id, role, label) => ({
    id,
    role,
    name: label,
    provider: null,
    model: null,
    status: 'queued',
    text: '',
    reasoning: '',
    ms: 0,
    note: null,
  });

  // slots already claimed by drafters — worker fallbacks avoid duplicating
  // them (control agents may share models with drafters)
  const workerSlots = (cfg.workers || []).filter((w) => w && w.model);
  const used = [...workerSlots];

  // ── 0 · RESEARCH the web (optional — makes every agent smarter) ───────────
  let web = null;
  if (s.web !== false) {
    cb.onStage?.({ stage: 'research', label: 'RESEARCHING' });
    const query = researchQuery(userText, 'chat');
    const a = mk('researcher', 'researcher', 'Researcher');
    a.status = 'running';
    a.provider = 'web';
    a.model = 'search';
    a.text = `Searching: "${query}"`;
    emitAgent(a);
    const t0 = performance.now();
    try {
      web = await searchWeb(query, { signal, fetchImpl: cfg.webFetch, deep: true });
      a.status = 'done';
      a.ms = Math.round(performance.now() - t0);
      a.text = web.ok
        ? `"${query}" → ${web.sources.length} sources${web.readCount ? ` · ${web.readCount} pages read live` : ''}: ${web.sources.slice(0, 4).map((x) => x.title).join(' · ')}`
        : `"${query}" → no results, answering from model knowledge`;
      emitAgent({ ...a });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      a.status = 'error';
      a.error = friendlyError(e);
      emitAgent({ ...a });
    }
  }
  const webBlock = web?.ok
    ? `--- WEB KNOWLEDGE (researched by the Researcher agent) ---\n${web.knowledge}\n--- END WEB KNOWLEDGE ---\n\n`
    : '';

  // ── 1 · PLAN ───────────────────────────────────────────────────────────────
  let brief = '';
  if (cfg.planner && s.planner !== false && cfg.planner.model) {
    cb.onStage?.({ stage: 'plan', label: 'PLANNING' });
    const a = mk('planner', 'planner', 'Planner');
    a.status = 'running';
    a.provider = cfg.planner.provider;
    a.model = cfg.planner.model;
    emitAgent(a);
    const agent = { ...a };
    const patch = (p) => Object.assign(agent, p) && emitAgent({ ...agent });
    try {
      const r = await runResilient({
        attempts: buildAttempts(cfg.planner, pool, used, 2),
        used,
        system: SYSTEMS.planner,
        messages: webBlock
          ? [...history, { role: 'user', content: `${webBlock}Weave any relevant facts, data and references into the brief.` }]
          : history,
        keyOf: key,
        temperature: 0.4,
        maxTokens: 700,
        signal,
        transport,
        onDelta: (d) => patch({ status: 'running', text: (agent.text += d) }),
        onSwitch: (next, err) =>
          patch({
            provider: next.provider,
            model: next.model,
            note: `switched to ${modelLabel(next.provider, next.model)} after failure`,
          }),
      });
      patch({ ...r, status: 'done' });
      brief = r.text;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      patch({ status: 'error', error: friendlyError(e) });
    }
  }

  // ── 2 · DRAFT (parallel, staggered, with failover) ────────────────────────
  cb.onStage?.({ stage: 'draft', label: 'DRAFTING' });
  const drafts = [];
  await Promise.all(
    workerSlots.map(async (slot, i) => {
      const letter = ROLE_LETTERS[i] || `#${i + 1}`;
      const a = mk('w' + i, 'worker', `Drafter ${letter}`);
      a.letter = letter;
      a.status = 'running';
      a.provider = slot.provider;
      a.model = slot.model;
      emitAgent(a);
      const agent = { ...a };
      const patch = (p) => Object.assign(agent, p) && emitAgent({ ...agent });
      try {
        const r = await runResilient({
          attempts: buildAttempts(slot, pool, used, 3),
          used,
          system: SYSTEMS.worker(letter, modelLabel(slot.provider, slot.model)),
          messages: brief || webBlock
            ? [
                ...history,
                {
                  role: 'user',
                  content:
                    webBlock +
                    (brief ? `--- TEAM BRIEF (from the Planner) ---\n${brief.slice(0, 2500)}\n--- END BRIEF ---\n\n` : '') +
                    'Now write your answer to the user\'s latest message above.',
                },
              ]
            : history,
          keyOf: key,
          temperature: temp,
          maxTokens: s.maxTokens || 4000,
          signal,
          transport,
          staggerMs: s.stagger !== false ? i * 1400 : 0,
          onDelta: (d) => patch({ status: 'running', text: (agent.text += d) }),
          onReasoning: (d) => patch({ status: 'running', reasoning: (agent.reasoning += d) }),
          onSwitch: (next, err) =>
            patch({
              provider: next.provider,
              model: next.model,
              text: '',
              reasoning: '',
              note: `switched to ${modelLabel(next.provider, next.model)} — ${String(err || '').slice(0, 90)}`,
            }),
        });
        patch({ ...r, status: 'done' });
        drafts.push({ letter, agent, text: r.text, model: modelLabel(r.provider, r.model), provider: r.provider, modelId: r.model });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        patch({ status: 'error', error: friendlyError(e) });
      }
    })
  );

  if (!drafts.length) {
    throw new ApiError('All drafting agents failed (no working model found). Check your keys or try the free Pollinations models.', {});
  }

  // ── 3 · REVIEW ────────────────────────────────────────────────────────────
  let review = '';
  let verdict = null;
  if (cfg.critic && s.critic !== false && cfg.critic.model) {
    cb.onStage?.({ stage: 'review', label: 'REVIEWING' });
    const a = mk('critic', 'critic', 'Reviewer');
    a.status = 'running';
    a.provider = cfg.critic.provider;
    a.model = cfg.critic.model;
    emitAgent(a);
    const agent = { ...a };
    const patch = (p) => Object.assign(agent, p) && emitAgent({ ...agent });
    try {
      const draftsBlock = drafts
        .map((d) => `### DRAFT ${d.letter} — by ${d.model}\n${String(d.text).slice(0, 6000)}`)
        .join('\n\n---\n\n');
      const r = await runResilient({
        attempts: buildAttempts(cfg.critic, pool, used, 2),
        used,
        system: SYSTEMS.critic,
        messages: [{ role: 'user', content: `The user asked:\n"""${userText.slice(0, 3000)}"""\n\nThe drafts:\n\n${draftsBlock}` }],
        keyOf: key,
        temperature: 0.3,
        maxTokens: 1200,
        signal,
        transport,
        onDelta: (d) => patch({ status: 'running', text: (agent.text += d) }),
        onSwitch: (next, err) =>
          patch({
            provider: next.provider,
            model: next.model,
            note: `switched to ${modelLabel(next.provider, next.model)} after failure`,
          }),
      });
      patch({ ...r, status: 'done' });
      review = r.text;
      verdict = parseVerdict(review);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      patch({ status: 'error', error: friendlyError(e) });
    }
  }

  // ── 4 · SYNTHESIZE (streamed as the final answer) ─────────────────────────
  cb.onStage?.({ stage: 'synthesize', label: 'SYNTHESIZING' });
  const byLetter = (l) => drafts.find((d) => d.letter === l);
  const best = (verdict && byLetter(verdict)) || drafts.reduce((p, c) => (c.text.length > p.text.length ? c : p), drafts[0]);
  const others = drafts.filter((d) => d !== best);

  const synthSlot = cfg.synth && cfg.synth.model ? cfg.synth : { provider: best.provider, model: best.modelId };
  const a = mk('synth', 'synth', 'Synthesizer');
  a.status = 'running';
  a.provider = synthSlot.provider;
  a.model = synthSlot.model;
  emitAgent(a);
  const agent = { ...a };
  const patch = (p) => Object.assign(agent, p) && emitAgent({ ...agent });

  const synthMessages = [
    {
      role: 'user',
      content:
        `The user asked:\n"""${userText.slice(0, 3000)}"""\n\n` +
        webBlock +
        (brief ? `Team brief:\n${brief.slice(0, 2000)}\n\n` : '') +
        `BEST DRAFT (by ${best.model}) — use as your base:\n${String(best.text).slice(0, 9000)}` +
        (others.length
          ? `\n\nOTHER DRAFTS (mine extra ideas from these):\n${others.map((d) => `— Draft ${d.letter} (${d.model}):\n${String(d.text).slice(0, 3000)}`).join('\n')}`
          : '') +
        (review ? `\n\nREVIEW NOTES from the Reviewer:\n${review.slice(0, 3000)}` : '') +
        `\n\nWrite the final answer now.`,
    },
  ];

  let finalText = '';
  let finalReasoning = '';
  try {
    const t0 = performance.now();
    const r = await runResilient({
      attempts: buildAttempts(synthSlot, pool, used, 2),
      used,
      system: SYSTEMS.synth,
      messages: synthMessages,
      keyOf: key,
      temperature: temp,
      maxTokens: s.maxTokens || 4000,
      signal,
      transport,
      onDelta: (d) => cb.onFinalDelta?.(d),
      onReasoning: (d) => cb.onFinalReasoning?.(d),
      onSwitch: (next, err) =>
        patch({
          provider: next.provider,
          model: next.model,
          note: `switched to ${modelLabel(next.provider, next.model)} after failure`,
        }),
    });
    finalText = r.text;
    finalReasoning = r.reasoning || '';
    patch({ ...r, status: 'done', ms: Math.round(performance.now() - t0) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    patch({ status: 'error', error: friendlyError(e) });
    // graceful fallback: ship the best draft as the final answer
    finalText = best.text + `\n\n---\n*⚠ The synthesizer failed (${agent.error}). Showing the best draft (Draft ${best.letter} · ${best.model}).*`;
    cb.onFinalDelta?.(finalText);
  }

  cb.onStage?.({ stage: 'done', label: 'COMPLETE' });

  return {
    finalText,
    finalReasoning,
    brief,
    review,
    verdict,
    bestLetter: best.letter,
    webSources: web?.ok ? web.sources : [],
    agents: agents.map((x) => ({ ...x })),
    stats: {
      drafters: drafts.length,
      models: drafts.map((d) => d.model),
      totalMs: agents.reduce((p, c) => p + (c.ms || 0), 0),
    },
  };
}
