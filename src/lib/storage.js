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

// Guard: base64 images (OpenAI) can be megabytes. If conversations grow past
// ~4MB, drop the oldest embedded data-URL images (URL-based ones are tiny and
// are regenerated on demand by Pollinations anyway).
function stripBigImages(convs) {
  return convs.map((c) => ({
    ...c,
    messages: (c.messages || []).map((m) =>
      m.kind === 'image' && Array.isArray(m.images)
        ? {
            ...m,
            images: m.images.map((im) =>
              typeof im?.src === 'string' && im.src.startsWith('data:') ? { ...im, src: null, expired: true } : im
            ),
          }
        : m
    ),
  }));
}

export const storage = {
  loadKeys: () => load(K.keys, {}),
  saveKeys: (v) => save(K.keys, v),
  loadSettings: () =>
    load(K.settings, {
      accent: 'green',
      mode: 'team', // 'solo' | 'team' | 'image'
      transport: 'auto', // 'auto' | 'direct' | 'proxy'
      temperature: 0.7,
      maxTokens: 4000,
      planner: true,
      critic: true,
      stagger: true,
      sidebarCollapsed: false,
    }),
  saveSettings: (v) => save(K.settings, v),
  loadConvs: () => load(K.convs, []),
  saveConvs: (v) => {
    let convs = v;
    try {
      if (JSON.stringify(convs).length > 4_000_000) convs = stripBigImages(convs);
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
  loadImage: () => load(K.image, { provider: 'pollinations', model: 'flux', aspect: '1:1', count: 1 }),
  saveImage: (v) => save(K.image, v),
  loadRuns: () => load(K.runs, []),
  saveRuns: (v) => save(K.runs, v.slice(0, 20)),
};

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2)) + '';
}
