// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · App store (hand-rolled observable + useSyncExternalStore)
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { storage, uid } from '@lib/storage.js';
import { streamChat, friendlyError } from '@lib/ai.js';
import { generateImage, IMAGE_ASPECTS } from '@lib/images.js';
import { runTeam, SYSTEMS } from '@lib/engine.js';
import { searchWeb } from '@lib/websearch.js';
import { runProject, upgradeProject as runUpgrade } from '@lib/projects.js';
import { modelLabel, getProvider, getModel, PROVIDERS } from '@shared/providers.js';

// ── state ────────────────────────────────────────────────────────────────────
let state = {
  booted: false,
  serverOk: null, // null = checking
  envKeys: [], // provider ids with server-side env keys
  keys: storage.loadKeys(),
  settings: storage.loadSettings(),
  solo: storage.loadSolo(),
  image: storage.loadImage(),
  prj: storage.loadPrj(),
  projects: storage.loadProjects(),
  activeProjectId: null,
  projectBusy: false,
  squad: storage.loadSquad(),
  conversations: storage.loadConvs(),
  activeId: null,
  view: 'chat',
  agentsOpen: false,
  sidebarOpen: false,
  studio: null, // { img, msgId } → image viewer/editor modal
  streaming: false,
  streamMsg: null, // {convId, msgId}
  toasts: [],
  runs: storage.loadRuns(),
  liveModels: {}, // providerId → [models] fetched live
};

const subs = new Set();
function getState() {
  return state;
}
function setState(patch, { persist = false } = {}) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
  if (persist) schedulePersist();
}
function subscribe(f) {
  subs.add(f);
  return () => subs.delete(f);
}
export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ── persistence (debounced) ──────────────────────────────────────────────────
let persistTimer = null;
function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    storage.saveKeys(state.keys);
    storage.saveSettings(state.settings);
    storage.saveSolo(state.solo);
    storage.saveImage(state.image);
    storage.savePrj(state.prj);
    storage.saveProjects(state.projects);
    storage.saveSquad(state.squad);
    storage.saveConvs(state.conversations.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, streaming: false })) })));
    storage.saveRuns(state.runs);
  }, 900);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function activeConv(s = state) {
  return s.conversations.find((c) => c.id === s.activeId) || null;
}
function updateMessage(convId, msgId, patch) {
  setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id !== convId
        ? c
        : { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
    ),
  }));
}

// throttled stream buffer
let streamBuf = null;
function queueStreamPatch(convId, msgId, patch) {
  if (!streamBuf || streamBuf.convId !== convId || streamBuf.msgId !== msgId) {
    if (streamBuf) flushStreamBuf();
    streamBuf = { convId, msgId, patch: {}, timer: null };
  }
  Object.assign(streamBuf.patch, patch);
  if (!streamBuf.timer) streamBuf.timer = setTimeout(flushStreamBuf, 48);
}
function flushStreamBuf() {
  if (!streamBuf) return;
  const { convId, msgId, patch } = streamBuf;
  clearTimeout(streamBuf.timer);
  streamBuf = null;
  updateMessage(convId, msgId, patch);
}

function toast(msg, type = 'info') {
  const id = uid();
  setState({ toasts: [...state.toasts, { id, msg, type }] });
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
}

// ── availability ─────────────────────────────────────────────────────────────
export function availableProviders(s = state) {
  return PROVIDERS.filter((p) => !p.needsKey || hasCredential(p.id, s));
}
// a provider is usable if the browser holds a key OR the server has one via env
export function hasCredential(pid, s = state) {
  return !!(s.keys && s.keys[pid]) || (s.envKeys || []).includes(pid);
}
export function providerStatus(p, s = state) {
  if (!p.needsKey) return 'ready';
  return hasCredential(p.id, s) ? 'ready' : 'nokey';
}

const SQUAD_PREFS = [
  { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324:free' },
  { provider: 'deepseek', model: 'deepseek-chat' },
  { provider: 'qwen', model: 'qwen3-max' },
  { provider: 'github', model: 'openai/gpt-4o-mini' },
  { provider: 'mistral', model: 'mistral-small-latest' },
  { provider: 'cerebras', model: 'llama-3.3-70b' },
  { provider: 'openrouter', model: 'qwen/qwen3-coder:free' },
  { provider: 'openrouter', model: 'openai/gpt-oss-120b:free' },
  { provider: 'pollinations', model: 'openai' },
  { provider: 'pollinations', model: 'qwen-coder' },
  { provider: 'pollinations', model: 'mistral' },
  { provider: 'demo', model: 'nexus-demo' },
];
// Ordered fallback pool: every model the user can actually run right now
// (has a key or needs none). Used for automatic agent failover.
export function buildPool(s = state) {
  const pool = [];
  const seen = new Set();
  const add = (provider, model) => {
    const k = provider + '/' + model;
    if (seen.has(k) || !getModel(provider, model) || !hasCredential(provider, s)) return;
    seen.add(k);
    pool.push({ provider, model });
  };
  for (const p of SQUAD_PREFS) add(p.provider, p.model);
  for (const m of s.liveModels.pollinations || []) add('pollinations', m.id);
  add('pollinations', 'openai');
  add('pollinations', 'qwen-coder');
  add('pollinations', 'mistral');
  add('demo', 'nexus-demo');
  return pool;
}
export function recommendedSquad(s = state) {
  const picks = [];
  for (const pref of SQUAD_PREFS) {
    if (picks.length >= 3) break;
    if (!hasCredential(pref.provider, s)) continue;
    if (picks.some((p) => p.provider === pref.provider && p.model === pref.model)) continue;
    picks.push(pref);
  }
  if (!picks.length) picks.push({ provider: 'pollinations', model: 'openai' });
  const second = picks[1] || picks[0];
  return {
    workers: [picks[0], second],
    planner: picks[2] || second,
    critic: picks[2] || second,
    synth: picks[0],
  };
}

// ── server health + live catalogs ────────────────────────────────────────────
async function pingServer() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    const j = await r.json();
    setState({ serverOk: !!j.ok, envKeys: Array.isArray(j.envKeys) ? j.envKeys : [] });
  } catch {
    setState({ serverOk: false });
  }
}

async function fetchLiveModels() {
  // Pollinations publishes a live, keyless model catalog
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://text.pollinations.ai/models', { signal: ctl.signal });
    clearTimeout(t);
    const list = await r.json();
    if (Array.isArray(list)) {
      const models = list
        .filter((m) => m && m.name && !(m.output || []).includes('image') && !/whisper|tts|audio/i.test(String(m.name)))
        .slice(0, 14)
        .map((m) => ({
          id: m.name,
          label: m.description ? String(m.description).slice(0, 42) : m.name,
          tags: ['FREE', 'LIVE'],
        }));
      if (models.length) {
        setState({ liveModels: { ...state.liveModels, pollinations: models } });
        remapPollinations(models);
      }
    }
  } catch {}
}

// If the live catalog renamed models, remap saved picks to valid ones
function remapPollinations(models) {
  const ids = new Set(models.map((m) => m.id));
  const fix = (slot) =>
    slot && slot.provider === 'pollinations' && !ids.has(slot.model) ? { ...slot, model: models[0].id } : slot;
  setState((s) => {
    const solo = fix(s.solo);
    const squad = {
      ...s.squad,
      workers: (s.squad.workers || []).map(fix),
      planner: fix(s.squad.planner),
      critic: fix(s.squad.critic),
      synth: fix(s.squad.synth),
    };
    return { solo, squad };
  }, { persist: true });
}

// ── conversations ────────────────────────────────────────────────────────────
function newConversation() {
  const conv = { id: uid(), title: 'New chat', ts: Date.now(), messages: [] };
  setState((s) => ({ conversations: [conv, ...s.conversations], activeId: conv.id, view: 'chat' }), { persist: true });
  return conv;
}
function ensureConversation() {
  return activeConv() || newConversation();
}
function selectConversation(id) {
  setState({ activeId: id, view: 'chat' });
}
function deleteConversation(id) {
  setState((s) => {
    const conversations = s.conversations.filter((c) => c.id !== id);
    return { conversations, activeId: s.activeId === id ? conversations[0]?.id || null : s.activeId };
  }, { persist: true });
}
function clearAll() {
  setState({ conversations: [], activeId: null });
}

// ── generation ───────────────────────────────────────────────────────────────
let abortCtl = null;

async function generate(convId, history) {
  const conv = state.conversations.find((c) => c.id === convId);
  if (!conv) return;
  const { settings, keys, solo, squad } = state;
  const mode = settings.mode || 'team';

  const msg = {
    id: uid(),
    role: 'assistant',
    content: '',
    reasoning: '',
    mode,
    kind: mode === 'image' ? 'image' : undefined,
    model:
      mode === 'solo'
        ? modelLabel(solo.provider, solo.model)
        : mode === 'image'
        ? `${state.image.model} · ${state.image.provider === 'pollinations' ? 'Pollinations' : 'OpenAI'}`
        : null,
    agents: [],
    stages: [],
    images: [],
    streaming: true,
    ts: Date.now(),
  };
  setState((s) => ({
    conversations: s.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, msg] } : c)),
    streaming: true,
    streamMsg: { convId, msgId: msg.id },
    agentsOpen: mode === 'team' ? true : s.agentsOpen,
  }));

  abortCtl = new AbortController();
  const signal = abortCtl.signal;
  const t0 = performance.now();

  const finish = (patch) => {
    flushStreamBuf();
    updateMessage(convId, msg.id, { streaming: false, ms: Math.round(performance.now() - t0), ...patch });
    setState({ streaming: false, streamMsg: null });
    schedulePersist();
  };

  try {
    if (mode === 'image') {
      const cfg = state.image || {};
      const aspect = IMAGE_ASPECTS.find((x) => x.id === cfg.aspect) || IMAGE_ASPECTS[0];
      const count = Math.max(1, Math.min(4, cfg.count || 1));
      const prompt = history[history.length - 1]?.content || '';
      const images = [];
      let lastErr = null;
      for (let i = 0; i < count; i++) {
        try {
          const img = await generateImage({
            provider: cfg.provider || 'pollinations',
            model: cfg.model || 'flux',
            prompt,
            aspect: aspect.id,
            apiKey: keys[cfg.provider === 'openai-images' ? 'openai' : cfg.provider],
            signal,
          });
          images.push(img);
          queueStreamPatch(convId, msg.id, { images: [...images] });
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          lastErr = e;
          if (!images.length) throw e;
          break;
        }
      }
      finish({ images, error: lastErr ? `Some images failed: ${friendlyError(lastErr)}` : undefined });
    } else if (mode === 'solo') {
      let text = '';
      let reasoning = '';
      // 🌐 Researcher — web knowledge before the model answers
      let soloSystem = SYSTEMS.solo;
      if (settings.web !== false) {
        try {
          const web = await searchWeb(history[history.length - 1]?.content || '', { signal });
          if (web.ok) {
            soloSystem += `\n\n${web.knowledge}`;
            queueStreamPatch(convId, msg.id, { sources: web.sources.map((s) => ({ source: s.source, title: s.title, url: s.url })) });
          }
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
        }
      }
      const r = await streamChat({
        provider: solo.provider,
        model: solo.model,
        messages: history,
        system: soloSystem,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        apiKey: keys[solo.provider],
        signal,
        transport: settings.transport,
        onDelta: (d) => {
          text += d;
          queueStreamPatch(convId, msg.id, { content: text });
        },
        onReasoning: (d) => {
          reasoning += d;
          queueStreamPatch(convId, msg.id, { reasoning });
        },
      });
      finish({ content: r.text || text, reasoning: r.reasoning || reasoning });
    } else {
      // local accumulators — never read streamed content back from state (it
      // lags behind the 60ms flush buffer and would drop text)
      let finalAcc = '';
      let finalReasonAcc = '';
      const agentMap = new Map();
      const stages = [];
      const result = await runTeam({
        messages: history,
        cfg: { ...squad, settings, keys, pool: buildPool() },
        signal,
        cb: {
          onStage: (st) => {
            stages.push(st);
            queueStreamPatch(convId, msg.id, { stages: [...stages] });
          },
          onAgent: (a) => {
            agentMap.set(a.id, a);
            queueStreamPatch(convId, msg.id, { agents: [...agentMap.values()] });
          },
          onFinalDelta: (d) => {
            finalAcc += d;
            queueStreamPatch(convId, msg.id, { content: finalAcc });
          },
          onFinalReasoning: (d) => {
            finalReasonAcc += d;
            queueStreamPatch(convId, msg.id, { reasoning: finalReasonAcc });
          },
        },
      });
      finish({
        content: result.finalText,
        reasoning: result.finalReasoning,
        stats: result.stats,
        verdict: result.verdict,
        sources: result.webSources?.length ? result.webSources.map((s) => ({ source: s.source, title: s.title, url: s.url })) : undefined,
      });
      setState((s) => ({
        runs: [
          {
            ts: Date.now(),
            prompt: (history[history.length - 1]?.content || '').slice(0, 120),
            models: result.stats.models,
            drafters: result.stats.drafters,
            ms: result.stats.totalMs,
            excerpt: result.finalText.slice(0, 180),
          },
          ...s.runs,
        ].slice(0, 20),
      }));
      schedulePersist();
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      finish({ aborted: true });
      return;
    }
    toast(friendlyError(e), 'error');
    finish({ error: friendlyError(e) });
  }
}

function sendMessage(text) {
  const content = String(text || '').trim();
  if (!content || state.streaming) return;
  const conv = ensureConversation();
  const userMsg = { id: uid(), role: 'user', content, ts: Date.now() };
  setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === conv.id
        ? {
            ...c,
            title: c.messages.length === 0 ? content.replace(/\s+/g, ' ').slice(0, 48) : c.title,
            messages: [...c.messages, userMsg],
          }
        : c
    ),
  }), { persist: true });
  const history = [...(activeConv()?.messages || [])].map((m) => ({ role: m.role, content: m.content }));
  generate(conv.id, history);
}

function regenerate(msgId) {
  if (state.streaming) return;
  const conv = activeConv();
  if (!conv) return;
  const idx = conv.messages.findIndex((m) => m.id === msgId);
  if (idx < 0) return;
  const history = conv.messages.slice(0, idx).map((m) => ({ role: m.role, content: m.content }));
  setState((s) => ({
    conversations: s.conversations.map((c) => (c.id === conv.id ? { ...c, messages: c.messages.slice(0, idx) } : c)),
  }), { persist: true });
  generate(conv.id, history);
}

function editUserMessage(msgId, newText) {
  if (state.streaming) return;
  const conv = activeConv();
  if (!conv) return;
  const idx = conv.messages.findIndex((m) => m.id === msgId);
  if (idx < 0) return;
  const content = String(newText || '').trim();
  if (!content) return;
  setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === conv.id
        ? { ...c, messages: c.messages.slice(0, idx).concat([{ ...c.messages[idx], content, edited: true }]) }
        : c
    ),
  }), { persist: true });
  const history = [...(activeConv()?.messages || [])].map((m) => ({ role: m.role, content: m.content }));
  generate(conv.id, history);
}

function deleteMessage(msgId) {
  const conv = activeConv();
  if (!conv) return;
  setState((s) => ({
    conversations: s.conversations.map((c) => (c.id === conv.id ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c)),
  }), { persist: true });
}

function stopGeneration() {
  abortCtl?.abort();
}

// ── projects ─────────────────────────────────────────────────────────────────
let projectCtl = null;
let projBuf = null;

function flushProjectBuf() {
  if (!projBuf) return;
  const { pid, fields } = projBuf;
  clearTimeout(projBuf.timer);
  projBuf = null;
  setState((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, ...fields } : p)) }));
}
function updateProject(pid, patch) {
  setState((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, ...patch } : p)) }));
}

async function startProject(idea) {
  const text = String(idea || '').trim();
  if (!text || state.projectBusy) return;
  const pid = uid();
  const proj = {
    id: pid,
    idea: text,
    title: 'New project',
    description: '',
    files: [],
    agents: [],
    stages: [],
    status: 'planning',
    createdAt: Date.now(),
    testReport: null,
    report: null,
    model: modelLabel(state.prj.provider, state.prj.model),
  };
  setState(
    (s) => ({ projects: [proj, ...s.projects].slice(0, 6), activeProjectId: pid, view: 'projects', projectBusy: true }),
    { persist: true }
  );

  projectCtl = new AbortController();
  const emit = (fields) => {
    if (!projBuf || projBuf.pid !== pid) {
      flushProjectBuf();
      projBuf = { pid, fields: {}, timer: null };
    }
    Object.assign(projBuf.fields, fields);
    if (!projBuf.timer) projBuf.timer = setTimeout(flushProjectBuf, 60);
  };

  try {
    await runProject({
      idea: text,
      model: state.prj,
      pool: buildPool(),
      keys: state.keys,
      settings: state.settings,
      signal: projectCtl.signal,
      cb: { onDoc: emit },
      web: state.settings.web !== false,
    });
  } catch (e) {
    if (e?.name === 'AbortError') updateProject(pid, { status: 'stopped' });
    else {
      updateProject(pid, { status: 'error', error: friendlyError(e) });
      toast(friendlyError(e), 'error');
    }
  } finally {
    flushProjectBuf();
    setState({ projectBusy: false });
    schedulePersist();
  }
}

async function startUpgrade(request) {
  const text = String(request || '').trim();
  const proj = state.projects.find((p) => p.id === state.activeProjectId);
  if (!text || !proj || state.projectBusy) return;
  setState({ projectBusy: true });

  projectCtl = new AbortController();
  const pid = proj.id;
  const emit = (fields) => {
    if (!projBuf || projBuf.pid !== pid) {
      flushProjectBuf();
      projBuf = { pid, fields: {}, timer: null };
    }
    Object.assign(projBuf.fields, fields);
    if (!projBuf.timer) projBuf.timer = setTimeout(flushProjectBuf, 60);
  };

  try {
    await runUpgrade({
      project: proj,
      request: text,
      model: state.prj,
      pool: buildPool(),
      keys: state.keys,
      settings: state.settings,
      signal: projectCtl.signal,
      cb: { onDoc: emit },
      web: state.settings.web !== false,
    });
    toast(`Project upgraded to v${(state.projects.find((p) => p.id === pid)?.version) || 2} ✓`);
  } catch (e) {
    if (e?.name === 'AbortError') updateProject(pid, { status: 'stopped', upgradeNote: null });
    else {
      updateProject(pid, { status: 'error', error: friendlyError(e), upgradeNote: null });
      toast(friendlyError(e), 'error');
    }
  } finally {
    flushProjectBuf();
    setState({ projectBusy: false });
    schedulePersist();
  }
}

// ── boot ─────────────────────────────────────────────────────────────────────
function boot() {
  if (state.booted) return;
  setState({ booted: true, activeId: state.conversations[0]?.id || null });
  pingServer();
  setInterval(pingServer, 45000);
  fetchLiveModels();
}

// ── actions ──────────────────────────────────────────────────────────────────
export const actions = {
  boot,
  setView: (view) => setState({ view }),
  setAgentsOpen: (v) => setState({ agentsOpen: v }),
  setSidebarOpen: (v) => setState({ sidebarOpen: v }),
  setSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } }), { persist: true }),
  setAccent: (accent) => {
    document.documentElement.dataset.acc = accent;
    setState((s) => ({ settings: { ...s.settings, accent } }), { persist: true });
  },
  setKeys: (patch) => setState((s) => ({ keys: { ...s.keys, ...patch } }), { persist: true }),
  removeKey: (providerId) =>
    setState((s) => {
      const keys = { ...s.keys };
      delete keys[providerId];
      return { keys };
    }, { persist: true }),
  setSolo: (patch) => setState((s) => ({ solo: { ...s.solo, ...patch } }), { persist: true }),
  setImage: (patch) => setState((s) => ({ image: { ...s.image, ...patch } }), { persist: true }),
  setPrjModel: (v) => setState((s) => ({ prj: { ...s.prj, ...v } }), { persist: true }),
  openProjectWizard: () => setState({ view: 'projects', activeProjectId: null }),
  selectProject: (id) => setState({ view: 'projects', activeProjectId: id }),
  deleteProject: (id) =>
    setState(
      (s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
      }),
      { persist: true }
    ),
  startProject,
  upgradeProject: startUpgrade,
  stopProject: () => projectCtl?.abort(),
  openStudio: (img, msgId = null) => setState({ studio: { img, msgId } }),
  closeStudio: () => setState({ studio: null }),
  setSquad: (patch) => setState((s) => ({ squad: { ...s.squad, ...patch } }), { persist: true }),
  applyRecommendedSquad: () => setState({ squad: recommendedSquad() }, { persist: true }),
  newConversation,
  selectConversation,
  deleteConversation,
  clearAll,
  sendMessage,
  regenerate,
  editUserMessage,
  deleteMessage,
  stopGeneration,
  toast,
  pingServer,
  getProvider,
  activeConv,
};

export { activeConv };
