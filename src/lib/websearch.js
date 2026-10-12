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

// ── the Researcher ───────────────────────────────────────────────────────────
// searchWeb(query, { signal, fetchImpl }) →
//   { ok, query, sources:[{source,title,url,extract}], knowledge }
// `knowledge` is the prompt-ready context block injected into the agents.
export async function searchWeb(query, { signal, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { ok: false, query, sources: [], knowledge: '' };
  const q = clean(query, 300);
  if (!q) return { ok: false, query, sources: [], knowledge: '' };

  const jobs = [
    wikipedia(q, f, signal).catch(() => []),
    duckduckgo(q, f, signal).catch(() => []),
  ];
  if (TECHY.test(q)) jobs.push(github(q, f, signal).catch(() => []));
  const [wiki, ddg, gh] = await Promise.all(jobs);

  const sources = [...wiki, ...ddg, ...(gh || [])].slice(0, 8);
  if (!sources.length) return { ok: false, query, sources: [], knowledge: '' };

  let knowledge = `## WEB KNOWLEDGE — researched for "${q}"\nUse these facts and references when answering. Cite source names naturally where relevant.\n`;
  if (wiki.length) {
    knowledge += `\n### Encyclopedic knowledge (Wikipedia)\n`;
    for (const s of wiki) knowledge += `**${s.title}** — ${s.extract}\n`;
  }
  if (ddg.length) {
    knowledge += `\n### Quick answers & related (DuckDuckGo)\n`;
    for (const s of ddg) knowledge += `**${s.title}** — ${s.extract}\n`;
  }
  if (gh?.length) {
    knowledge += `\n### Open-source references (GitHub — inspiration & prior art)\n`;
    for (const s of gh) knowledge += `- ${s.extract}\n`;
  }
  return { ok: true, query, sources, knowledge: knowledge.slice(0, 6000) };
}

// Short label per source for the UI chips
export function sourceGlyph(s) {
  return s === 'github' ? '⭑' : s === 'wikipedia' ? '📚' : '🦆';
}
