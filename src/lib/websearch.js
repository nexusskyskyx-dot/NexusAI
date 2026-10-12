// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Web Research Toolbox (the Researcher agent)
//
// Gives every agent real-world knowledge: before the team thinks, the
// Researcher searches the open web and distills what it finds into a context
// block that is injected into every agent's prompt.
//
// Sources (all free, no keys, CORS-friendly — called straight from the
// browser so they work on any self-hosted instance):
//   🌐 Wikipedia  — encyclopedic knowledge (search + intro extracts)
//   🦆 DuckDuckGo — instant answers + related topics
//   ⭑ GitHub     — open-source references for code/app/tech queries
//
// Everything degrades gracefully: any source that fails is skipped, and if
// they all fail the team just answers without web knowledge.
// ─────────────────────────────────────────────────────────────────────────────

const TECHY = /app|code|librar|framework|api|game|website|web app|build|tool|software|program|script|plugin|extension|dashboard|clone|simulator|generator|js|python|react|vue|node|css|html|ai\b|ml\b/i;

function fetchWithTimeout(fetchImpl, url, { signal, ms = 7000, headers } = {}) {
  return new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new Error('timeout')), ms);
    const onOuterAbort = () => ctl.abort(new Error('aborted'));
    if (signal) {
      if (signal.aborted) return reject(new Error('aborted'));
      signal.addEventListener('abort', onOuterAbort, { once: true });
    }
    fetchImpl(url, { signal: ctl.signal, headers })
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onOuterAbort);
      });
  });
}

async function jfetch(fetchImpl, url, opts) {
  const r = await fetchWithTimeout(fetchImpl, url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function clean(s, n) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}

// ── source fetchers ──────────────────────────────────────────────────────────
async function wikipedia(query, fetchImpl, signal) {
  const out = [];
  const search = await jfetch(
    fetchImpl,
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=3&srsearch=${encodeURIComponent(query)}`,
    { signal }
  );
  const hits = (search?.query?.search || []).map((h) => h.title).slice(0, 3);
  if (!hits.length) return out;
  const extracts = await jfetch(
    fetchImpl,
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(hits.join('|'))}`,
    { signal }
  );
  const pages = Object.values(extracts?.query?.pages || {});
  for (const p of pages) {
    if (!p.extract) continue;
    out.push({
      source: 'wikipedia',
      title: clean(p.title, 90),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`,
      extract: clean(p.extract, 900),
    });
  }
  return out;
}

async function duckduckgo(query, fetchImpl, signal) {
  const out = [];
  const d = await jfetch(
    fetchImpl,
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    { signal }
  );
  if (d?.AbstractText) {
    out.push({
      source: 'duckduckgo',
      title: clean(d.Heading || query, 90),
      url: d.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      extract: clean(d.AbstractText, 700),
    });
  }
  for (const t of (d?.RelatedTopics || []).slice(0, 3)) {
    if (t?.Text && t?.FirstURL) {
      out.push({
        source: 'duckduckgo',
        title: clean(t.Text.split(' - ')[0], 80),
        url: t.FirstURL,
        extract: clean(t.Text, 300),
      });
    }
  }
  return out;
}

async function github(query, fetchImpl, signal) {
  const out = [];
  const g = await jfetch(
    fetchImpl,
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`,
    { signal, headers: { Accept: 'application/vnd.github+json' } }
  );
  for (const item of (g?.items || []).slice(0, 3)) {
    if (!item?.full_name) continue;
    out.push({
      source: 'github',
      title: clean(item.full_name, 90),
      url: item.html_url || `https://github.com/${item.full_name}`,
      extract: clean(`${item.full_name} (★${item.stargazers_count || 0}) — ${item.description || 'open-source project'}`, 300),
    });
  }
  return out;
}

// ── domain-aware query rewriting ─────────────────────────────────────────────
// NexusAI BUILDS web projects. When a request is about MAKING something,
// ambiguous nouns must resolve to their web-dev sense — "make a professional
// portfolio" means WEB DESIGN PORTFOLIOS (layouts, typography, sections), not
// financial holdings or money capitals. The Researcher therefore searches
// topics that GO WITH what the user is actually asking for.

const AMBIGUOUS = {
  portfolio: 'web design portfolio website',
  resume: 'online resume portfolio design',
  cv: 'online resume portfolio design',
  store: 'online store web design',
  shop: 'e-commerce web design',
  marketplace: 'online marketplace web design',
  bank: 'personal finance web app',
  wallet: 'fintech web app UI',
  blog: 'blog website design',
  magazine: 'digital magazine web design',
  newspaper: 'news website design',
  restaurant: 'restaurant website design',
  hotel: 'hotel website design',
  gym: 'fitness web app design',
  school: 'education website design',
  gallery: 'online art gallery web design',
  landing: 'landing page web design',
};

const BUILD_VERBS = /\b(make|made|create|build|design|develop|generate|write|code|draft|prototype|mock ?up|mockup)\b/i;
const BUILD_OBJECTS = /\b(app|application|website|web ?site|web ?page|web ?app|page|site|game|clone|tool|dashboard|ui|interface|landing|frontend|front ?end)\b/i;
const STRIP = /\b(please|can you|could you|would you|i want to|want to|i need to|need to|help me|make|made|create|build|develop|generate|write|code|a|an|the|my|me|some|for)\b/gi;

// researchQuery(text, kind) — kind: 'project' (always building) | 'chat'
// (heuristics decide). Returns the domain-matched search query.
export function researchQuery(text, kind = 'chat') {
  const raw = clean(text, 240);
  if (!raw) return raw;
  const building = kind === 'project' || BUILD_VERBS.test(raw) || BUILD_OBJECTS.test(raw);
  if (!building) return raw; // literal question — research exactly what was asked
  let q = raw.toLowerCase();
  for (const [word, sense] of Object.entries(AMBIGUOUS)) {
    q = q.replace(new RegExp(`\\b${word}\\b`, 'g'), sense);
  }
  q = q
    .replace(STRIP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return q || raw;
}

// ── LIVE page reading — real information, fetched now ─────────────────────────
const READ_MAX_SOURCES = 3; // pages read fully per research run
const READ_CHARS = 2600; // chars of each page injected into the knowledge

function proxyBase() {
  if (typeof globalThis.__NEXUS_PROXY_BASE === 'string') return globalThis.__NEXUS_PROXY_BASE;
  return ''; // browser: same origin as the app
}

// Read one URL's full text, live. Route 1: the Jina reader (keyless,
// CORS-friendly — works straight from the browser). Route 2: the NexusAI
// server's /api/fetch (strips HTML server-side — reaches CORS-blocked sites
// on self-hosted instances). Returns { url, text, via } or null.
export async function readUrl(url, { signal, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f || !/^https?:\/\//i.test(url)) return null;
  // 1 · Jina reader — clean markdown of any page
  try {
    const r = await fetchWithTimeout(f, `https://r.jina.ai/${url}`, { signal, ms: 9000 });
    if (r.ok) {
      const text = await r.text();
      if (text && text.trim().length > 200) return { url, text: text.slice(0, READ_CHARS * 2), via: 'jina' };
    }
  } catch {}
  // 2 · self-hosted server fetcher
  try {
    const r = await fetchWithTimeout(f, `${proxyBase()}/api/fetch?url=${encodeURIComponent(url)}`, { signal, ms: 9000 });
    if (r.ok) {
      const j = await r.json();
      if (j?.text && String(j.text).trim().length > 100) return { url, text: String(j.text).slice(0, READ_CHARS * 2), via: 'server' };
    }
  } catch {}
  return null;
}

// Read the most valuable sources fully, in parallel (live fetching).
// Wikipedia articles first (full article > intro snippet), then quick-answer
// pages, then GitHub repos. Skips duplicates.
async function readSources(sources, { signal, fetchImpl } = {}) {
  const seen = new Set();
  const picks = [];
  const rank = (s) => (s.source === 'wikipedia' ? 0 : s.source === 'duckduckgo' ? 1 : 2);
  for (const s of [...sources].sort((a, b) => rank(a) - rank(b))) {
    let host = '';
    try { host = new URL(s.url).host; } catch { continue; }
    if (seen.has(host)) continue;
    seen.add(host);
    picks.push(s);
    if (picks.length >= READ_MAX_SOURCES) break;
  }
  const pages = await Promise.all(picks.map((s) => readUrl(s.url, { signal, fetchImpl })));
  return picks.map((s, i) => ({ source: s, page: pages[i] })).filter((x) => x.page);
}

// ── MDN Web Docs — authoritative coding knowledge ─────────────────────────────
// Free JSON search endpoint; called browser-direct, with the reader fallback.
async function mdnSearch(q, fetchImpl, signal) {
  const api = `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(q)}&locale=en-US&limit=3`;
  let docs = null;
  try {
    const j = await jfetch(fetchImpl, api, { signal });
    if (Array.isArray(j?.documents)) docs = j.documents;
  } catch {}
  if (!docs) {
    const r = await readUrl(api, { signal, fetchImpl }).catch(() => null);
    if (r) {
      try {
        const m = r.text.match(/\{[\s\S]*\}/);
        if (m) docs = JSON.parse(m[0])?.documents;
      } catch {}
    }
  }
  if (!Array.isArray(docs)) return [];
  return docs
    .slice(0, 3)
    .filter((d) => d && d.title)
    .map((d) => ({
      source: 'mdn',
      title: clean(d.title, 90),
      url: d.mdn_url
        ? String(d.mdn_url).startsWith('http')
          ? String(d.mdn_url)
          : 'https://developer.mozilla.org' + String(d.mdn_url)
        : 'https://developer.mozilla.org',
      extract: clean(d.summary || 'MDN Web Docs reference', 400),
    }));
}

// ── design galleries — real current designs as reference aesthetics ──────────
const GALLERIES = ['https://darkmodedesign.com/', 'https://www.lapa.ninja/'];

// Read a design gallery and extract its featured designs (titles + links).
// The reader returns markdown, so links are parsed generically — works for
// any server-rendered gallery. Self-links and nav items are filtered.
export async function galleryRefs(_query, { signal, fetchImpl } = {}) {
  for (const g of GALLERIES) {
    const r = await readUrl(g, { signal, fetchImpl }).catch(() => null);
    if (!r || !r.text) continue;
    let ghost = '';
    try { ghost = new URL(g).host; } catch { continue; }
    const seen = new Set();
    const refs = [];
    for (const m of r.text.matchAll(/\[([^\]\n]{3,70})\]\((https?:\/\/[^)\s]+)\)/g)) {
      const title = clean(m[1], 70);
      let host = '';
      try { host = new URL(m[2]).host; } catch { continue; }
      if (!title || host === ghost) continue;
      if (/^(about|submit|twitter|x|instagram|github|rss|contact|privacy|terms|login|sign|home|categories|tags)\b/i.test(title)) continue;
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      refs.push({ title, url: m[2] });
      if (refs.length >= 6) break;
    }
    if (refs.length >= 2) return refs;
  }
  return [];
}

// ── design intelligence — current-year trends + real reference designs ───────
// researchDesign(subject) → { knowledge, refs, trends }
// `knowledge` is a DESIGN block appended to the Designer agent's prompt so
// generated projects follow what actually looks good THIS year.
export async function researchDesign(subject, { signal, fetchImpl } = {}) {
  const year = new Date().getFullYear();
  const topic = clean(subject, 60);
  const [w, refs] = await Promise.all([
    searchWeb(`web design trends ${year} ${topic}`, { signal, fetchImpl, deep: true }).catch(() => null),
    galleryRefs(topic, { signal, fetchImpl }).catch(() => []),
  ]);
  let knowledge = '';
  if (w && w.ok && w.knowledge) {
    knowledge = `\nDESIGN INTELLIGENCE — current ${year} web design trends (researched live — apply them):\n${w.knowledge.slice(0, 2000)}\n`;
  }
  if (refs.length) {
    knowledge +=
      `\nREFERENCE AESTHETICS — real current designs; emulate their style, palette and layout sense (never copy content):\n` +
      refs.map((r) => `- ${r.title} — ${r.url}`).join('\n') +
      '\n';
  }
  return { knowledge, refs, trends: !!(w && w.ok) };
}

// ── the Researcher ───────────────────────────────────────────────────────────
// searchWeb(query, { signal, fetchImpl, deep }) →
//   { ok, query, sources:[{source,title,url,extract,read}], pages, readCount, knowledge }
// `knowledge` is the prompt-ready context block injected into the agents.
// `deep: true` = LIVE FETCHING — the top sources are opened and read fully.
export async function searchWeb(query, { signal, fetchImpl, deep } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { ok: false, query, sources: [], knowledge: '' };
  const q = clean(query, 300);
  if (!q) return { ok: false, query, sources: [], knowledge: '' };

  const jobs = [
    wikipedia(q, f, signal).catch(() => []),
    duckduckgo(q, f, signal).catch(() => []),
  ];
  const techy = TECHY.test(q);
  if (techy) {
    jobs.push(github(q, f, signal).catch(() => []));
    jobs.push(mdnSearch(q, f, signal).catch(() => []));
  }
  const [wiki, ddg, gh, mdn] = await Promise.all(jobs);

  const sources = [...wiki, ...ddg, ...(mdn || []), ...(gh || [])].slice(0, 8);
  if (!sources.length) return { ok: false, query, sources: [], pages: [], readCount: 0, knowledge: '' };

  // LIVE FETCHING — open and read the top pages for real, full information
  let pages = [];
  if (deep) {
    try {
      pages = await readSources(sources, { signal, fetchImpl });
      for (const p of pages) p.source.read = true;
    } catch {}
  }

  const today = new Date().toISOString().slice(0, 10);
  let knowledge = `## WEB KNOWLEDGE — researched LIVE on ${today} for "${q}"\nUse these facts and references when answering. Cite source names naturally where relevant.\n`;
  if (wiki.length) {
    knowledge += `\n### Encyclopedic knowledge (Wikipedia)\n`;
    for (const s of wiki) knowledge += `**${s.title}** — ${s.extract}\n`;
  }
  if (ddg.length) {
    knowledge += `\n### Quick answers & related (DuckDuckGo)\n`;
    for (const s of ddg) knowledge += `**${s.title}** — ${s.extract}\n`;
  }
  if (mdn?.length) {
    knowledge += `\n### Coding docs (MDN Web Docs — authoritative references)\n`;
    for (const s of mdn) knowledge += `**${s.title}** — ${s.extract}\n`;
  }
  if (gh?.length) {
    knowledge += `\n### Open-source references (GitHub — inspiration & prior art)\n`;
    for (const s of gh) knowledge += `- ${s.extract}\n`;
  }
  if (pages.length) {
    knowledge += `\n### FULL PAGE CONTENT — fetched live (the real pages, not snippets)\n`;
    for (const p of pages) {
      knowledge += `\n#### ${p.source.title} (${p.source.url})\n${p.page.text.slice(0, READ_CHARS)}\n`;
    }
  }
  return { ok: true, query, sources, pages, readCount: pages.length, knowledge: knowledge.slice(0, 9000) };
}

// Short label per source for the UI chips
export function sourceGlyph(s) {
  return s === 'github' ? '⭑' : s === 'wikipedia' ? '📚' : '🦆';
}
