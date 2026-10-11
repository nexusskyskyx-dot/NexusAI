// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Multi-Agent Engine ("the Team")
//
//   ┌─────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐    ┌─────────┐
//   │ PLANNER │ →  │ DRAFTER A│ │ DRAFTER B│ │ DRAFTER C│ →  │ REVIEW  │
//   └─────────┘    └──────────┘ └──────────┘ └──────────┘    └────┬────┘
//        brief      parallel drafts (different models)     verdict │
//   ┌──────────────┐                                            │ merge plan
//   │ SYNTHESIZER  │ ← best draft + review notes + brief        ▼
//   └──────────────┘ → final streamed answer
//
// Every step degrades gracefully: a failing drafter is skipped, and if the
// synthesizer fails the best surviving draft becomes the final answer.
// ─────────────────────────────────────────────────────────────────────────────
import { streamChat, ApiError, friendlyError } from './ai.js';
import { modelLabel } from '@shared/providers.js';

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

// Run one agent; returns {text, reasoning, error, ms}
async function runAgent({ name, role, provider, model, system, messages, apiKey, temperature, maxTokens, signal, onDelta, onReasoning, staggerMs, transport }) {
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
  void name; void role;
  return { text, reasoning, ms: Math.round(performance.now() - t0) };
}

function parseVerdict(review) {
  const m = String(review).match(/##\s*Verdict[\s\S]{0,400}?\b([A-E])\b/);
  return m ? m[1] : null;
}

// ── TEAM RUN ─────────────────────────────────────────────────────────────────
// cfg: { workers:[{provider,model}], planner:{provider,model}|null,
//        critic:{provider,model}|null, synth:{provider,model}, settings,
//        keys, transport }
// cb:   { onStage, onAgent(agent), onFinalDelta, onFinalReasoning }
// message history: [{role, content}]
export async function runTeam({ messages, cfg, cb, signal }) {
  const keys = cfg.keys || {};
  const s = cfg.settings || {};
  const temp = typeof s.temperature === 'number' ? s.temperature : 0.7;
  const transport = s.transport || 'auto';
  const history = trimHistory(messages);
  const userText = lastUserText(messages);

  const agents = [];
  const emitAgent = (a) => {
    const i = agents.findIndex((x) => x.id === a.id);
    if (i >= 0) agents[i] = a;
    else agents.push(a);
    cb.onAgent?.({ ...a });
  };

  const key = (p) => keys[p] || '';
  const mk = (id, role, slot, labelOverride) => ({
    id,
    role,
    name: labelOverride || modelLabel(slot?.provider, slot?.model),
    provider: slot?.provider,
    model: slot?.model,
    status: 'queued',
    text: '',
    reasoning: '',
    ms: 0,
  });

  // ── 1 · PLAN ───────────────────────────────────────────────────────────────
  let brief = '';
  if (cfg.planner && s.planner !== false && cfg.planner.model) {
    cb.onStage?.({ stage: 'plan', label: 'PLANNING' });
    const a = mk('planner', 'planner', cfg.planner, 'Planner');
    a.status = 'running';
    emitAgent(a);
    try {
      const r = await runAgent({
        ...a,
        system: SYSTEMS.planner,
        messages: history,
        apiKey: key(a.provider),
        temperature: 0.4,
        maxTokens: 700,
        signal,
        transport,
        onDelta: (d) => emitAgent({ ...a, status: 'running', text: a.text += d }),
      });
      a.text = r.text;
      a.reasoning = r.reasoning;
      a.ms = r.ms;
      a.status = 'done';
      brief = r.text;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      a.status = 'error';
      a.error = friendlyError(e);
    }
    emitAgent({ ...a });
  }

  // ── 2 · DRAFT (parallel, staggered) ───────────────────────────────────────
  cb.onStage?.({ stage: 'draft', label: 'DRAFTING' });
  const workerSlots = (cfg.workers || []).filter((w) => w && w.model);
  const drafts = [];
  await Promise.all(
    workerSlots.map(async (slot, i) => {
      const letter = ROLE_LETTERS[i] || `#${i + 1}`;
      const a = mk('w' + i, 'worker', slot, `Drafter ${letter}`);
      a.letter = letter;
      a.status = 'running';
      emitAgent(a);
      const agent = { ...a };
      try {
        const r = await runAgent({
          ...agent,
          system: SYSTEMS.worker(letter, modelLabel(slot.provider, slot.model)),
          messages: brief
            ? [...history, { role: 'user', content: `--- TEAM BRIEF (from the Planner) ---\n${brief.slice(0, 2500)}\n--- END BRIEF ---\n\nNow write your answer to the user's latest message above.` }]
            : history,
          apiKey: key(slot.provider),
          temperature: temp,
          maxTokens: s.maxTokens || 4000,
          signal,
          transport,
          staggerMs: s.stagger !== false ? i * 1400 : 0,
          onDelta: (d) => emitAgent({ ...agent, status: 'running', text: (agent.text += d) }),
          onReasoning: (d) => emitAgent({ ...agent, status: 'running', reasoning: (agent.reasoning += d) }),
        });
        agent.text = r.text;
        agent.reasoning = r.reasoning;
        agent.ms = r.ms;
        agent.status = 'done';
        drafts.push({ letter, agent, text: r.text, model: modelLabel(slot.provider, slot.model), provider: slot.provider, modelId: slot.model });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        agent.status = 'error';
        agent.error = friendlyError(e);
        emitAgent({ ...agent });
        return;
      }
      emitAgent({ ...agent });
    })
  );

  if (!drafts.length) {
    throw new ApiError('All drafting agents failed. Check your keys / try FREE models (Pollinations or OpenRouter free tier).', {});
  }

  // ── 3 · REVIEW ────────────────────────────────────────────────────────────
  let review = '';
  let verdict = null;
  if (cfg.critic && s.critic !== false && cfg.critic.model) {
    cb.onStage?.({ stage: 'review', label: 'REVIEWING' });
    const a = mk('critic', 'critic', cfg.critic, 'Reviewer');
    a.status = 'running';
    emitAgent(a);
    const agent = { ...a };
    try {
      const draftsBlock = drafts
        .map((d) => `### DRAFT ${d.letter} — by ${d.model}\n${String(d.text).slice(0, 6000)}`)
        .join('\n\n---\n\n');
      const r = await runAgent({
        ...agent,
        system: SYSTEMS.critic,
        messages: [
          { role: 'user', content: `The user asked:\n"""${userText.slice(0, 3000)}"""\n\nThe drafts:\n\n${draftsBlock}` },
        ],
        apiKey: key(a.provider),
        temperature: 0.3,
        maxTokens: 1200,
        signal,
        transport,
        onDelta: (d) => emitAgent({ ...agent, status: 'running', text: (agent.text += d) }),
      });
      agent.text = r.text;
      agent.ms = r.ms;
      agent.status = 'done';
      review = r.text;
      verdict = parseVerdict(review);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      agent.status = 'error';
      agent.error = friendlyError(e);
    }
    emitAgent({ ...agent });
  }

  // ── 4 · SYNTHESIZE (streamed as the final answer) ─────────────────────────
  cb.onStage?.({ stage: 'synthesize', label: 'SYNTHESIZING' });
  const byLetter = (l) => drafts.find((d) => d.letter === l);
  const best = (verdict && byLetter(verdict)) || drafts.reduce((p, c) => (c.text.length > p.text.length ? c : p), drafts[0]);
  const others = drafts.filter((d) => d !== best);

  const synthSlot = cfg.synth && cfg.synth.model ? cfg.synth : { provider: best.provider, model: best.modelId };
  const a = mk('synth', 'synth', synthSlot, 'Synthesizer');
  a.status = 'running';
  emitAgent(a);
  const agent = { ...a };

  const synthMessages = [
    {
      role: 'user',
      content:
        `The user asked:\n"""${userText.slice(0, 3000)}"""\n\n` +
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
  let finalMs = 0;
  try {
    const t0 = performance.now();
    const r = await streamChat({
      provider: synthSlot.provider,
      model: synthSlot.model,
      messages: synthMessages,
      system: SYSTEMS.synth,
      temperature: temp,
      maxTokens: s.maxTokens || 4000,
      apiKey: key(synthSlot.provider),
      signal,
      transport,
      onDelta: (d) => cb.onFinalDelta?.(d),
      onReasoning: (d) => cb.onFinalReasoning?.(d),
    });
    finalText = r.text;
    finalReasoning = r.reasoning;
    finalMs = Math.round(performance.now() - t0);
    agent.text = r.text;
    agent.ms = finalMs;
    agent.status = 'done';
    emitAgent({ ...agent });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    agent.status = 'error';
    agent.error = friendlyError(e);
    emitAgent({ ...agent });
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
    agents: agents.map((x) => ({ ...x })),
    stats: {
      drafters: drafts.length,
      models: drafts.map((d) => d.model),
      totalMs: agents.reduce((p, c) => p + (c.ms || 0), 0),
    },
  };
}
