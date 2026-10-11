// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · AI transport layer
// One function — streamChat() — talks to every provider, choosing between:
//   DIRECT : browser → provider (works for CORS-friendly providers; keys stay
//            in the browser, works even when the server has no internet)
//   PROXY  : browser → NexusAI server → provider (works for OpenAI/DeepSeek/
//            Qwen and when server env keys are set)
// Auto mode tries the best transport first and falls back on network errors.
// ─────────────────────────────────────────────────────────────────────────────
import { getProvider, getModel } from '@shared/providers.js';

export class ApiError extends Error {
  constructor(message, { status = 0, network = false, provider = '' } = {}) {
    super(message);
    this.status = status;
    this.network = network;
    this.provider = provider;
  }
}

export function providerAvailable(providerId, keys) {
  const p = getProvider(providerId);
  if (!p) return false;
  return !p.needsKey || !!(keys && keys[providerId]);
}

// ── request body builders (provider-native) ─────────────────────────────────
export function buildBody(kind, req) {
  // req: { model, messages:[{role,content}], system, temperature, maxTokens, stream }
  if (kind === 'anthropic') {
    const msgs = [];
    for (const m of req.messages) {
      if (!m.content && m.content !== '') continue;
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const prev = msgs[msgs.length - 1];
      if (prev && prev.role === role) prev.content += '\n\n' + m.content;
      else msgs.push({ role, content: m.content });
    }
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    if (!msgs.length) msgs.push({ role: 'user', content: '(empty)' });
    const body = {
      model: req.model,
      max_tokens: req.maxTokens || 4096,
      stream: !!req.stream,
      messages: msgs,
    };
    if (req.system) body.system = req.system;
    if (typeof req.temperature === 'number') body.temperature = req.temperature;
    return body;
  }
  // openai-compatible
  const messages = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    if (m.content === undefined || m.content === null) continue;
    messages.push({ role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user', content: String(m.content) });
  }
  return {
    model: req.model,
    messages,
    stream: !!req.stream,
    temperature: typeof req.temperature === 'number' ? req.temperature : 0.7,
    max_tokens: req.maxTokens || 4096,
  };
}

function withExtraBody(provider, body) {
  if (!provider.extraBody) return body;
  return { ...body, ...provider.extraBody };
}

// ── SSE parsing ──────────────────────────────────────────────────────────────
function makeSSEParser(onEvent) {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') {
        onEvent({ done: true });
        continue;
      }
      try {
        onEvent({ json: JSON.parse(data) });
      } catch {}
    }
  };
}

function extractDelta(kind, json) {
  // returns { text?, reasoning?, done? }
  try {
    if (kind === 'anthropic') {
      if (json.type === 'content_block_delta') {
        if (json.delta?.type === 'thinking_delta') return { reasoning: json.delta.thinking || '' };
        if (json.delta?.type === 'text_delta') return { text: json.delta.text || '' };
      }
      if (json.type === 'message_stop') return { done: true };
      return {};
    }
    // openai-compatible
    const d = json.choices?.[0];
    if (!d) return {};
    if (json.choices?.[0]?.finish_reason) return { done: true, text: '' };
    const delta = d.delta || d.message || {};
    return {
      text: delta.content || '',
      reasoning: delta.reasoning_content || delta.reasoning || '',
    };
  } catch {
    return {};
  }
}

function extractFullText(kind, json) {
  try {
    if (kind === 'anthropic') {
      return (json.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('');
    }
    return json.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

// ── single attempt ───────────────────────────────────────────────────────────
const PROXY_BASE = globalThis.__NEXUS_PROXY_BASE || '';

async function attempt({ providerId, body, transport, signal }) {
  const provider = getProvider(providerId);
  const kind = provider.kind;
  let url, headers;
  if (transport === 'direct') {
    url = provider.baseUrl;
    headers = { 'Content-Type': 'application/json', ...(provider.headers ? provider.headers(body.__apiKey || '') : {}) };
    if (provider.directHeaders) Object.assign(headers, provider.directHeaders(body.__apiKey || ''));
    if (provider.needsKey && !body.__apiKey) {
      throw new ApiError(`${provider.name} needs an API key — add one in Keys & Models.`, { status: 401, provider: providerId });
    }
  } else {
    url = PROXY_BASE + '/api/proxy';
    headers = { 'Content-Type': 'application/json' };
  }

  const apiKey = body.__apiKey || '';
  const bodyToSend = withExtraBody(provider, (() => { const p = { ...body }; delete p.__apiKey; return p; })());

  const fetchOpts = { method: 'POST', headers, body: JSON.stringify(bodyToSend), signal };
  if (transport === 'proxy') {
    fetchOpts.body = JSON.stringify({ provider: providerId, apiKey: apiKey || undefined, body: bodyToSend });
  }

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(
      transport === 'direct'
        ? `Could not reach ${provider.name} directly from the browser (${e.message}).`
        : `Could not reach the NexusAI server (${e.message}).`,
      { network: true, provider: providerId }
    );
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.error?.type || msg;
    } catch {
      try { msg = (await res.text()).slice(0, 300) || msg; } catch {}
    }
    if (res.status === 401 || res.status === 403)
      msg = `${provider.name}: invalid or unauthorized API key.`;
    if (res.status === 429)
      msg = `${provider.name}: rate limited (429). Free tiers are shared — retry shortly or switch model.`;
    if (res.status === 402) msg = `${provider.name}: this model requires credits (402). Pick a FREE model.`;
    throw new ApiError(msg, { status: res.status, provider: providerId });
  }
  return res;
}

// ── public API ───────────────────────────────────────────────────────────────
// streamChat({ provider, model, messages, system, temperature, maxTokens,
//              apiKey, signal, onDelta, onReasoning })
// → { text, reasoning }
export async function streamChat(opts) {
  const provider = getProvider(opts.provider);
  if (!provider) throw new ApiError(`Unknown provider "${opts.provider}"`, { provider: opts.provider });
  const kind = provider.kind;
  const stream = opts.onDelta ? true : !!opts.stream;
  const body = buildBody(kind, { ...opts, stream: true });
  body.__apiKey = opts.apiKey || '';

  const mode = opts.transport || 'auto';
  const canDirect = provider.direct && provider.kind !== 'demo';
  let order;
  if (mode === 'direct') order = canDirect ? ['direct'] : ['proxy'];
  else if (mode === 'proxy') order = ['proxy'];
  else order = canDirect ? ['direct', 'proxy'] : ['proxy'];

  let lastErr = null;
  for (let t = 0; t < order.length; t++) {
    const transport = order[t];
    let res;
    try {
      res = await attempt({ providerId: provider.id, body, transport, signal: opts.signal });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (e.network && t < order.length - 1) continue; // try the other transport
      if ((e.status === 429 || e.status >= 500) && !opts.signal?.aborted) {
        // one patient retry with backoff
        await new Promise((r) => setTimeout(r, 1500));
        try {
          res = await attempt({ providerId: provider.id, body, transport, signal: opts.signal });
        } catch (e2) {
          if (e2.name === 'AbortError') throw e2;
          lastErr = e2;
          if (e2.network && t < order.length - 1) continue;
          throw e2;
        }
      } else throw e;
    }

    // stream it
    let text = '';
    let reasoning = '';
    const handleEvent = (ev) => {
      if (ev.done) return;
      const { text: dt, reasoning: dr } = extractDelta(kind, ev.json);
      if (dt) {
        text += dt;
        opts.onDelta?.(dt);
      }
      if (dr) {
        reasoning += dr;
        opts.onReasoning?.(dr);
      }
    };
    const parser = makeSSEParser(handleEvent);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
    return { text, reasoning };
  }
  throw lastErr || new ApiError('All transports failed', { provider: provider.id });
}

// completeChat(...) → full text, no streaming (used for key tests etc.)
export async function completeChat(opts) {
  const provider = getProvider(opts.provider);
  const body = buildBody(provider.kind, { ...opts, stream: false });
  body.__apiKey = opts.apiKey || '';
  const mode = opts.transport || 'auto';
  const canDirect = provider.direct && provider.kind !== 'demo';
  let order;
  if (mode === 'direct') order = canDirect ? ['direct'] : ['proxy'];
  else if (mode === 'proxy') order = ['proxy'];
  else order = canDirect ? ['direct', 'proxy'] : ['proxy'];

  let lastErr = null;
  for (const transport of order) {
    try {
      const res = await attempt({ providerId: provider.id, body, transport, signal: opts.signal });
      const json = await res.json();
      return extractFullText(provider.kind, json);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (e.network && order.length > 1) continue;
      throw e;
    }
  }
  throw lastErr;
}

export function friendlyError(e) {
  if (e instanceof ApiError) return e.message;
  return e?.message || 'Unexpected error';
}
