// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Local persistence (browser localStorage only)
// Keys live in YOUR browser and are sent straight to the provider per request.
// They are never stored on any NexusAI server.
// ─────────────────────────────────────────────────────────────────────────────
const K = {
  keys: 'nexus.keys.v1',
  settings: 'nexus.settings.v1',
  convs: 'nexus.convs.v1',
  squad: 'nexus.squad.v1',
  solo: 'nexus.solo.v1',
  image: 'nexus.image.v1',
  prj: 'nexus.prj.v1',
  projects: 'nexus.projects.v1',
  runs: 'nexus.runs.v1',
};

function load(k, fallback) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

// Guard: embedded images can be megabytes. If conversations grow past the
// budget, shed weight GRADUALLY and oldest-first, keeping every image
// recoverable (v1.16.1):
//   pass 1 · drop heavy raw `src` data-URLs (keep the small durable `data`
//           snapshot + `regen` recipe)
//   pass 2 · drop `data` snapshots oldest-first (keep `regen` → the image
//           re-fetches itself from its deterministic recipe)
//   pass 3 · last resort: mark expired — only for images with no recipe
const CONV_BUDGET = 4_000_000;

function sizeOf(v) {
  try {
    return JSON.stringify(v).length;
  } catch {
    return Infinity;
  }
}

function mapImages(convs, fn) {
  return convs.map((c) => ({
    ...c,
    messages: (c.messages || []).map((m) =>
      m.kind === 'image' && Array.isArray(m.images) ? { ...m, images: m.images.map(fn) } : m
    ),
  }));
}

function stripBigImages(convs) {
  let out = convs;
  // pass 1 — raw data-URL srcs (big OpenAI payloads) → durable snapshot + regen
  out = mapImages(out, (im) =>
    typeof im?.src === 'string' && im.src.startsWith('data:')
      ? { ...im, src: im.data || null, expired: !im.data && !im.regen?.url }
      : im
  );
  // pass 2 — drop durable data snapshots oldest-first, keeping regen recipes
  let idx = 0;
  const images = [];
  for (const c of out) for (const m of c.messages || []) if (m.kind === 'image') images.push(...(m.images || []));
  while (sizeOf(out) > CONV_BUDGET && idx < images.length) {
    const im = images[idx++];
    if (im?.data) {
      delete im.data;
      if (!im.src) im.expired = !im.regen?.url;
    }
  }
  if (sizeOf(out) <= CONV_BUDGET) return out;
  // pass 3 — nothing left to shed gracefully
  return mapImages(out, (im) => ({ ...im, src: null, data: null, expired: !im.regen?.url }));
}

export const storage = {
  loadKeys: () => load(K.keys, {}),
  saveKeys: (v) => save(K.keys, v),
  loadSettings: () => {
    const s = load(K.settings, {
      accent: 'blue',
      mode: 'team', // sticky pick when autoIntent is off
      autoIntent: true, // 🧭 route messages by detected intent
      transport: 'auto', // 'auto' | 'direct' | 'proxy'
      web: true, // 🌐 Researcher: search the web before answering
      temperature: 0.7,
      maxTokens: 4000,
      planner: true,
      critic: true,
      stagger: true,
      sidebarCollapsed: false,
    });
    // v1.7 one-time migration: the old default (green) becomes platinum.
    // v1.21 one-time migration: the default theme becomes saturated blue
    // (platinum users are moved; deliberately picked colors are kept).
    if (!s.accMigrated) {
      if (s.accent === 'green') s.accent = 'platinum';
      s.accMigrated = true;
    }
    if (!s.accMigrated2) {
      if (s.accent === 'platinum') s.accent = 'blue';
      s.accMigrated2 = true;
    }
    return s;
  },
  saveSettings: (v) => save(K.settings, v),
  loadConvs: () => load(K.convs, []),
  saveConvs: (v) => {
    let convs = v;
    try {
      if (sizeOf(convs) > CONV_BUDGET) convs = stripBigImages(convs);
    } catch {}
    save(K.convs, convs);
  },
  loadSquad: () =>
    load(K.squad, {
      workers: [
        { provider: 'pollinations', model: 'openai' },
        { provider: 'pollinations', model: 'qwen-coder' },
      ],
      planner: { provider: 'pollinations', model: 'mistral' },
      critic: { provider: 'pollinations', model: 'mistral' },
      synth: { provider: 'pollinations', model: 'openai' },
    }),
  saveSquad: (v) => save(K.squad, v),
  loadSolo: () => load(K.solo, { provider: 'pollinations', model: 'openai' }),
  saveSolo: (v) => save(K.solo, v),
  loadPrj: () => load(K.prj, { provider: 'pollinations', model: 'openai' }),
  savePrj: (v) => save(K.prj, v),
  loadProjects: () => load(K.projects, []),
  saveProjects: (v) => save(K.projects, Array.isArray(v) ? v.slice(0, 6) : []),
  loadImage: () => load(K.image, { provider: 'nexus-engine', model: 'black-forest-labs/flux.2-pro', aspect: '1:1', count: 1 }),
  saveImage: (v) => save(K.image, v),
  loadRuns: () => load(K.runs, []),
  saveRuns: (v) => save(K.runs, v.slice(0, 20)),
};

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2)) + '';
}
