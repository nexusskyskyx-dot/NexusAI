// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Project Engine v1.5
//
//   👋 FRIEND greets → 💡 idea
//   → 🧠 COORDINATOR  analyze_idea + plan_files      (features & file plan)
//   → 🎨 DESIGNER     write_file (html/css/svg)
//   → 💻 CODER        write_file (js/json)
//   → 🧪 TESTER 1     read_files + run_checks        (finds bugs, with lines)
//   → 🔬 VERIFIER     read_files + verify_bug        (Tester 2 — confirms or
//                                                     dismisses every report)
//   → 🔧 DEBUGGER     patch_file                     (only CONFIRMED bugs)
//   → 🧪 TESTER       run_checks again               (re-test → all pass ✅)
//   → 📝 DOCUMENTER   write_readme
//   → ⚡ OPTIMIZER     perf_audit + final_report      (✅ app works)
//
// Every agent has its own system prompt (job + tools) and fails over to the
// next model in the pool, exactly like the chat team. The offline demo
// provider can play every role, so the whole pipeline runs with zero keys.
//
// The run is narrated into `doc.chat` — a transcript of user / agent / system
// messages the Project room renders in its Chat section.
// ─────────────────────────────────────────────────────────────────────────────
import { streamChat, friendlyError } from './ai.js';
import { modelLabel } from '@shared/providers.js';
import { CONSOLE_SHIM } from './preview.js';
import { searchWeb, researchQuery } from './websearch.js';

export const PROJECT_STAGES = [
  { id: 'research', label: 'Research', glyph: '🌐', desc: 'Researcher searches the web for knowledge & ideas' },
  { id: 'plan', label: 'Plan', glyph: '🧠', desc: 'Coordinator analyzes the idea & plans the files' },
  { id: 'build', label: 'Build', glyph: '💻', desc: 'Designer & Coder write every file' },
  { id: 'test', label: 'Test', glyph: '🧪', desc: 'Tester 1 hunts for bugs' },
  { id: 'verify', label: 'Verify', glyph: '🔬', desc: 'Tester 2 (Verifier) confirms each bug' },
  { id: 'debug', label: 'Debug', glyph: '🔧', desc: 'Debugger patches the confirmed bugs' },
  { id: 'retest', label: 'Re-test', glyph: '✅', desc: 'Tester re-runs the checks' },
  { id: 'docs', label: 'Docs', glyph: '📝', desc: 'Documenter writes the README' },
  { id: 'report', label: 'Report', glyph: '⚡', desc: 'Optimizer ships the final report' },
];

// Every specialist: glyph, name, one-line job, and the TOOLS they own.
// The same list powers the system prompts, the chat narration and the Team tab.
export const ROLE_META = {
  coordinator: {
    glyph: '🧠', name: 'Coordinator',
    job: 'Breaks your idea into features, files and a build order',
    tools: ['analyze_idea', 'plan_files'],
  },
  designer: {
    glyph: '🎨', name: 'Designer',
    job: 'Crafts the structure & styling — HTML, CSS, SVG',
    tools: ['write_file'],
  },
  coder: {
    glyph: '💻', name: 'Coder',
    job: 'Writes the logic — JavaScript, state, events',
    tools: ['write_file'],
  },
  tester: {
    glyph: '🧪', name: 'Tester',
    job: 'Hunts for real bugs in every file, with line numbers',
    tools: ['read_files', 'run_checks'],
  },
  verifier: {
    glyph: '🔬', name: 'Verifier',
    job: 'Second tester — re-checks every report, confirms or dismisses it',
    tools: ['read_files', 'verify_bug'],
  },
  debugger: {
    glyph: '🔧', name: 'Debugger',
    job: 'Patches only the bugs the Verifier confirmed',
    tools: ['patch_file'],
  },
  researcher: {
    glyph: '🌐', name: 'Researcher',
    job: 'Searches the web for knowledge, facts and ideas before the team plans',
    tools: ['search_web', 'read_sources', 'summarize'],
  },
  documenter: {
    glyph: '📝', name: 'Documenter',
    job: 'Writes the project README',
    tools: ['write_readme'],
  },
  reporter: {
    glyph: '⚡', name: 'Optimizer',
    job: 'Audits performance & ships the final report',
    tools: ['perf_audit', 'final_report'],
  },
};

// ── system prompts (one per agent — job + tools + output contract) ──────────
const SYS = {
  coordinator: `You are the COORDINATOR of the NexusAI project team.
YOUR JOB: turn the user's idea into a precise build plan for a small, self-contained web project (plain HTML/CSS/JS only — no build tools, no npm, no frameworks).
YOUR TOOLS (call both by filling the JSON below):
- analyze_idea → fill "features": the 3-6 key features the app needs
- plan_files   → fill "files": [{path, purpose}] — 3-6 files, folders like css/ and js/ when a type repeats, README.md last, lowercase, no spaces
Respond with ONLY valid JSON, no markdown fences:
{"title":"short project name","description":"one sentence","features":["…"],"files":[{"path":"…","purpose":"…"}],"steps":["…"]}`,

  builder: (role, path) => `You are the ${role === 'Designer' ? 'DESIGNER' : 'CODER'} (FILE BUILDER) of the NexusAI project team.
YOUR JOB: write the COMPLETE content of the file "${path}" — polished, complete, production-quality, consistent with the rest of the project.
YOUR TOOLS:
- write_file(path) → your entire response IS the file content this tool writes
Output ONLY the raw file content — no markdown fences, no commentary, no explanations.`,

  tester: (round) => `You are the TESTER of the NexusAI project team${round === 'retest' ? ' (RE-TEST ROUND — the Debugger just patched the project)' : ''}.
YOUR JOB: review the project files for REAL bugs only: broken file references, JS runtime errors, CSS selectors matching nothing, missing DOM ids, unusable UI.
YOUR TOOLS (call both by filling the JSON below):
- read_files  → you are given the full contents of every file
- run_checks  → fill "bugs": each with file, the 1-based "line" number if you can, a one-line "issue" and a concrete "fix"
- A file that others reference (script/link/src/href) but is MISSING or EMPTY is a CRITICAL bug — report it with file = the missing path.
Respond ONLY valid JSON, no fences:
{"verdict":"pass"|"issues","bugs":[{"file":"path","line":12,"issue":"…","fix":"…"}]}
Max 3 genuine bugs. If nothing is broken, verdict is "pass" with an empty bugs array. Never invent bugs to look busy.`,

  verifier: `You are the VERIFIER (second, independent tester) of the NexusAI project team.
YOUR JOB: re-check every bug the first Tester reported. Read the actual file contents and confirm only what you can reproduce; dismiss false alarms with a clear reason.
YOUR TOOLS (call both by filling the JSON below):
- read_files → you are given the full contents of every file
- verify_bug → fill "results": one entry per reported bug, same order
Respond ONLY valid JSON, no fences:
{"results":[{"file":"path","line":12,"confirmed":true,"reason":"reproduced — …"}]}
"confirmed" is false when the reported bug does not actually exist in the code.`,

  debugger: `You are the DEBUGGER of the NexusAI project team.
YOUR JOB: fix ONLY the confirmed bugs you receive. You are shown the whole project for context (so you can see if code is missing or inconsistent), but you must patch ONLY the affected files. Touch nothing else.
YOUR TOOLS:
- patch_file(path) → fill "files": every file you changed with its complete corrected content
Respond ONLY valid JSON, no fences:
{"files":[{"path":"…","content":"full fixed file content"}]}
Change nothing beyond the confirmed fixes.`,

  documenter: `You are the DOCUMENTER of the NexusAI project team.
YOUR JOB: write a README.md for the finished project: what it is, how to run it, file structure table, features.
YOUR TOOLS:
- write_readme → your entire response IS the README content
Rich Markdown, under 200 words. Output ONLY the raw markdown, no fences.`,

  reporter: `You are the OPTIMIZER of the NexusAI project team.
YOUR JOB: audit the finished project and deliver the FINAL REPORT to the user.
YOUR TOOLS (call both by filling your response):
- perf_audit     → note load/render wins in "Performance notes"
- final_report   → the report itself, in rich Markdown with exactly these sections:
## What was built
## Structure
## Quality (bugs found → verified → fixed)
## Performance notes
Bold key terms, under 200 words, no fences.`,
};

// ── parsing helpers ──────────────────────────────────────────────────────────
export function extractJSON(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '');
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (!depth) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export function stripFences(text) {
  const t = String(text || '').trim();
  const m = t.match(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n?```$/);
  if (m) return m[1];
  if (t.startsWith('```')) return t.replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/```\s*$/, '');
  return t;
}

function titleFromIdea(idea) {
  const words = String(idea)
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(a|an|the|my|with|for|and|app|website|project)$/i.test(w))
    .slice(0, 3)
    .join(' ');
  return words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : 'NexusAI Project';
}

function fallbackPlan(idea) {
  return {
    title: titleFromIdea(idea),
    description: String(idea).slice(0, 140),
    features: ['clean UI', 'interactivity', 'persistence-free simple state'],
    stack: ['html', 'css', 'js'],
    files: [
      { path: 'index.html', purpose: 'main page structure' },
      { path: 'css/style.css', purpose: 'styling' },
      { path: 'js/app.js', purpose: 'interactivity' },
      { path: 'README.md', purpose: 'documentation' },
    ],
    steps: ['structure', 'style', 'logic'],
  };
}

// ── preview assembly ─────────────────────────────────────────────────────────
export function assemblePreview(files) {
  const byPath = new Map(files.filter((f) => f.content).map((f) => [f.path.replace(/^\.\//, ''), f.content]));
  let html =
    (byPath.get('index.html') || '').trim()
      ? byPath.get('index.html')
      : files.find((f) => /\.html?$/i.test(f.path) && f.content?.trim())?.content;
  // no usable HTML page → synthesize a shell that links the project's real
  // css/js so the preview still boots instead of showing nothing
  if (!html) {
    const css = files.find((f) => /\.css$/i.test(f.path) && f.content?.trim())?.path;
    const js = files.find((f) => /\.m?js$/i.test(f.path) && f.content?.trim())?.path;
    if (css || js) {
      html =
        `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Project preview</title>\n` +
        (css ? `<link rel="stylesheet" href="${css}">\n` : '') +
        `</head>\n<body>\n<main class="shell"><h1>PROJECT PREVIEW</h1><p class="tagline">No HTML page was built — showing the project's styles &amp; scripts.</p><section class="panel"><button id="go" type="button">ACTIVATE</button><p id="out" class="out"></p></section></main>\n` +
        (js ? `<script src="${js}"></script>\n` : '') +
        `</body>\n</html>`;
    } else {
      html = '<div style="font-family:system-ui;padding:40px;color:#888">Waiting for index.html…</div>';
    }
  }

  // inline <link rel=stylesheet href="…css">
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (m, href) => {
    const c = byPath.get(href.replace(/^\.\//, '').replace(/^\//, ''));
    return c ? `<style>\n${c}\n</style>` : m;
  });
  // inline <script src="…js"></script>
  html = html.replace(/<script[^>]+src=["']([^"']+\.m?js)["'][^>]*>\s*<\/script>/gi, (m, src) => {
    const c = byPath.get(src.replace(/^\.\//, '').replace(/^\//, ''));
    return c ? `<script>\n${c}\n<\/script>` : m;
  });

  // inject console shim into <head> (or at top)
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + CONSOLE_SHIM);
  else html = CONSOLE_SHIM + html;
  return html;
}

// ── resilient ask with failover (shared by build & upgrade pipelines) ────────
function makeAsk({ model, pool, keys, settings, signal, onAgent }) {
  const key = (p) => (keys || {})[p] || '';
  const transport = settings?.transport || 'auto';
  const defMax = settings?.maxTokens || 4000;
  return async function ask({ id, role, system, user, temperature, maxTokens: mt, onDelta }) {
    const meta = ROLE_META[role] || { glyph: '◆', name: role };
    const slot = { provider: model.provider, model: model.model };
    const attempts = [slot];
    const seen = new Set([slot.provider + '/' + slot.model]);
    for (const cand of pool || []) {
      if (attempts.length >= 3) break;
      if (!cand?.model) continue;
      const k = cand.provider + '/' + cand.model;
      if (seen.has(k)) continue;
      seen.add(k);
      attempts.push({ provider: cand.provider, model: cand.model });
    }

    const t0 = performance.now();
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      const at = attempts[i];
      const base = {
        id,
        role,
        name: meta.name,
        provider: at.provider,
        model: at.model,
        status: 'running',
        text: '',
        ms: 0,
        note: i > 0 ? `switched to ${modelLabel(at.provider, at.model)} after failure` : null,
      };
      onAgent({ ...base });
      let acc = '';
      try {
        const r = await streamChat({
          provider: at.provider,
          model: at.model,
          system,
          messages: [{ role: 'user', content: user }],
          temperature,
          maxTokens: mt || defMax,
          apiKey: key(at.provider),
          signal,
          transport,
          onDelta: onDelta ? (d) => { acc += d; onDelta(d, acc); } : undefined,
        });
        onAgent({ ...base, status: 'done', text: r.text.slice(0, 400), ms: Math.round(performance.now() - t0) });
        return r.text;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastErr = e;
      }
    }
    onAgent({ id, role, name: meta.name, provider: model.provider, model: model.model, status: 'error', error: friendlyError(lastErr), text: '', ms: Math.round(performance.now() - t0) });
    throw lastErr;
  };
}

// ── chat narration (rendered by the Project room's Chat section) ─────────────
// say() upserts a message by id: {id, kind:'user'|'agent'|'sys', role, text, …}
// `initial` lets an upgrade run CONTINUE the project's existing transcript.
function makeChat(emit, initial = []) {
  const chat = [...initial];
  const say = (m) => {
    const msg = { ts: Date.now(), ...m };
    const i = chat.findIndex((x) => x.id === msg.id);
    if (i >= 0) chat[i] = { ...chat[i], ...msg };
    else chat.push(msg);
    emit({ chat: [...chat] });
  };
  return { chat, say };
}

const fileBlocks = (files, max = 4000) =>
  files
    .filter((f) => f.content)
    .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, max)}\n\`\`\``)
    .join('\n\n');

// status of EVERY file — so agents instantly see what exists and what's
// missing/empty (a referenced-but-missing file is a critical bug)
const manifestBlock = (files) =>
  'PROJECT MANIFEST (every file and its state):\n' +
  files
    .map((f) => {
      const state = f.content
        ? f.status === 'error'
          ? `written but ERRORED · ${f.bytes} bytes`
          : f.fallback || f.status === 'template'
          ? `⚠ TEMPLATE (builder failed/empty — working placeholder, ${f.bytes} bytes)`
          : `written · ${f.bytes} bytes`
        : f.status === 'writing'
        ? 'being written…'
        : f.status === 'error'
        ? 'MISSING (build failed)'
        : 'MISSING / EMPTY';
      return `- ${f.path} — ${state}`;
    })
    .join('\n');

// truncated view of files NOT in the focus set — full-project context
const othersBlock = (files, focusPaths, cap = 1500) =>
  files
    .filter((f) => f.content && !focusPaths.includes(f.path))
    .map((f) => `— ${f.path}:\n${String(f.content).slice(0, cap)}`)
    .join('\n\n');

// A real file is never smaller than this — anything less means the model
// returned nothing useful (empty output, pure commentary, dead stream).
const MIN_FILE_CHARS = 20;

// Minimal-but-WORKING file templates. When a builder fails or returns empty,
// these keep the project runnable (preview boots, references resolve) instead
// of shipping broken/empty files. The user is told and can ask for an upgrade.
export function fallbackFile(path, planFiles = [], title = 'NexusAI Project') {
  const paths = planFiles.map((p) => (typeof p === 'string' ? p : p.path)).filter(Boolean);
  const cssPath = paths.find((p) => /\.css$/i.test(p)) || 'css/style.css';
  const jsPath = paths.find((p) => /\.m?js$/i.test(p)) || 'js/app.js';
  if (/\.html?$/i.test(path)) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="${cssPath}" />
</head>
<body>
  <main class="shell">
    <header>
      <h1>${title.toUpperCase()}</h1>
      <p class="tagline">Working placeholder — ask for an upgrade to design this page fully.</p>
    </header>
    <section class="panel">
      <button id="go" type="button">ACTIVATE</button>
      <p id="out" class="out"></p>
    </section>
    <footer><small>NexusAI · template</small></footer>
  </main>
  <script src="${jsPath}"></script>
</body>
</html>`;
  }
  if (/\.css$/i.test(path)) {
    return `/* ${path} — working placeholder (ask for an upgrade to style it fully) */
* { box-sizing: border-box; margin: 0; }
body { background: #000; color: #f2f2f2; font-family: system-ui, sans-serif; min-height: 100vh; display: grid; place-items: center; }
.shell { width: min(680px, 92vw); text-align: center; }
h1 { font-size: clamp(30px, 6vw, 52px); font-weight: 800; letter-spacing: -0.03em; }
h1::after { content: ''; display: block; width: 64px; height: 3px; margin: 14px auto 0; background: #dcdde2; border-radius: 2px; }
.tagline { color: #8b8b93; margin: 14px 0 34px; font-weight: 600; }
.panel { border: 1px solid #1d1d22; background: #09090b; border-radius: 18px; padding: 36px 26px; }
button { background: #dcdde2; color: #0c0c0e; border: 0; border-radius: 999px; padding: 14px 34px; font-weight: 800; font-size: 15px; cursor: pointer; }
button:active { transform: scale(.97); }
.out { margin-top: 18px; color: #9b9ba4; font-weight: 600; min-height: 1.4em; }
footer { margin-top: 26px; color: #4b4b52; }`;
  }
  if (/\.m?js$/i.test(path)) {
    return `// ${path} — working placeholder (the model returned no code for this file)
// Ask for an upgrade and the Coder will write the real logic.
document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('out');
  document.getElementById('go')?.addEventListener('click', () => {
    if (out) out.textContent = 'Hello from ${path} — ask for an upgrade to build the real logic.';
    console.log('${path} activated');
  });
  console.log('${path} ready (placeholder)');
});`;
  }
  if (/\.md$/i.test(path)) {
    return `# ${title}\n\nWorking placeholder — the model returned no content for this file.\nAsk for an upgrade and the team will write it properly.\n`;
  }
  return `# ${path}\n\n(placeholder — the model returned no content for this file)\n`;
}

// finalize a file entry: retry once on empty, then fall back to a working
// template. Returns 'done' | 'template'. Never leaves a file empty.
export async function finalizeEntry({ ask, entry, buildAsk, retryNote, fallbackNote, say, planFiles, title }) {
  let raw = '';
  try {
    raw = await buildAsk();
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    entry.error = friendlyError(e);
  }
  entry.content = stripFences(raw);
  if (entry.content.trim().length < MIN_FILE_CHARS) {
    retryNote();
    try {
      raw = await buildAsk(true);
      entry.content = stripFences(raw);
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      entry.error = friendlyError(e);
    }
  }
  entry.bytes = entry.content.length;
  if (entry.content.trim().length >= MIN_FILE_CHARS) {
    entry.status = 'done';
    entry.fallback = false;
    return 'done';
  }
  entry.content = fallbackFile(entry.path, planFiles, title);
  entry.bytes = entry.content.length;
  entry.fallback = true;
  entry.status = 'template';
  fallbackNote();
  return 'template';
}

// ── the runner ───────────────────────────────────────────────────────────────
// runProject({ idea, model:{provider,model}, pool, keys, settings, signal, cb })
// cb.onDoc(fields) receives shallow doc patches (throttle-friendly).
// Returns the final doc snapshot.
export async function runProject({ idea, model, pool, keys, settings, signal, cb, web, webFetch }) {
  const temp = typeof settings?.temperature === 'number' ? settings.temperature : 0.7;
  const maxTokens = settings?.maxTokens || 4000;

  const doc = {
    title: '',
    description: '',
    plan: null,
    files: [],
    stages: [],
    agents: [],
    chat: [],
    testReport: null,
    report: null,
    status: 'planning',
    version: 1,
  };
  const filesMap = new Map();
  const agents = [];

  const emit = (fields) => {
    Object.assign(doc, fields);
    cb.onDoc?.(fields);
  };
  const emitAgent = (a) => {
    const i = agents.findIndex((x) => x.id === a.id);
    if (i >= 0) agents[i] = a;
    else agents.push(a);
    emit({ agents: [...agents] });
  };
  const stage = (id) => emit({ stages: [...doc.stages, id] });
  const emitFiles = () => emit({ files: [...filesMap.values()] });
  const { say } = makeChat(emit);

  // resilient ask with failover across the pool
  const ask = makeAsk({ model, pool, keys, settings, signal, onAgent: emitAgent });

  // 👤 the user's request opens the chat
  say({ id: 'u0', kind: 'user', text: String(idea).slice(0, 600) });

  // ── 0 · RESEARCHER (search_web) — optional web knowledge for the whole team
  let knowledge = '';
  if (web) {
    stage('research');
    emit({ status: 'researching' });
    const query = researchQuery(String(idea), 'project');
    say({ id: 'researcher', kind: 'agent', role: 'researcher', text: `Searching the web for “${query}”…`, tools: ROLE_META.researcher.tools });
    const rAgent = {
      id: 'researcher', role: 'researcher', name: 'Researcher',
      provider: 'web', model: 'search', status: 'running', text: '', ms: 0, note: null,
    };
    emitAgent({ ...rAgent });
    const t0 = performance.now();
    try {
      const w = await searchWeb(query, { signal, fetchImpl: webFetch, deep: true });
      knowledge = w.ok ? w.knowledge : '';
      emitAgent({ ...rAgent, status: 'done', ms: Math.round(performance.now() - t0), text: w.ok ? `${w.sources.length} sources` : 'no results' });
      say({
        id: 'researcher',
        kind: 'agent',
        role: 'researcher',
        text: w.ok ? `Found ${w.sources.length} sources${w.readCount ? ` · read ${w.readCount} pages live` : ''}:` : 'No web results — planning from model knowledge.',
        tools: ROLE_META.researcher.tools,
        sources: w.sources.map((s) => ({ source: s.source, title: s.title, url: s.url, read: !!s.read })),
        read: w.readCount || 0,
        done: true,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      emitAgent({ ...rAgent, status: 'error', error: friendlyError(e), ms: Math.round(performance.now() - t0) });
      say({ id: 'researcher', kind: 'agent', role: 'researcher', text: 'Web search unavailable — planning from model knowledge.', tools: ROLE_META.researcher.tools, done: true });
    }
  }
  const knowledgeBlock = knowledge ? `\n\nWEB KNOWLEDGE (researched for this project):\n${knowledge.slice(0, 3500)}\n` : '';

  // ── 1 · COORDINATOR (analyze_idea + plan_files) ────────────────────────────
  stage('plan');
  say({ id: 'coordinator', kind: 'agent', role: 'coordinator', text: 'Analyzing the idea…', tools: ROLE_META.coordinator.tools });
  let plan = null;
  try {
    const raw = await ask({
      id: 'coordinator',
      role: 'coordinator',
      system: SYS.coordinator,
      user: `PROJECT IDEA:\n${String(idea).slice(0, 2000)}${knowledgeBlock}`,
      temperature: 0.3,
      maxTokens: 900,
    });
    plan = extractJSON(raw);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  if (!plan || !Array.isArray(plan.files) || !plan.files.length) plan = fallbackPlan(idea);
  plan.files = plan.files
    .map((f) => (typeof f === 'string' ? { path: f } : f))
    .filter((f) => f && typeof f.path === 'string' && f.path.length < 120)
    .slice(0, 6);
  if (!Array.isArray(plan.features) || !plan.features.length) plan.features = plan.files.slice(0, 4).map((f) => f.purpose || f.path);
  emit({
    title: String(plan.title || titleFromIdea(idea)).slice(0, 80),
    description: String(plan.description || '').slice(0, 300),
    plan,
    status: 'building',
  });
  say({
    id: 'coordinator',
    kind: 'agent',
    role: 'coordinator',
    text: `Analyzing… ${plan.features.length} features needed.\nPlanned ${plan.files.length} files: ${plan.files.map((f) => f.path).join(', ')}.`,
    tools: ROLE_META.coordinator.tools,
    done: true,
  });

  // ── 2 · BUILDERS — Designer (html/css) & Coder (js) (write_file) ───────────
  stage('build');
  let built = 0;
  for (const f of plan.files) {
    if (/readme\.md$/i.test(f.path)) continue; // documenter writes it later
    const ext = f.path.split('.').pop().toLowerCase();
    const role = ['html', 'htm', 'css', 'svg'].includes(ext) ? 'designer' : 'coder';
    const entry = { path: f.path, purpose: f.purpose || '', content: '', status: 'writing', by: ROLE_META[role].name, bytes: 0 };
    filesMap.set(f.path, entry);
    emitFiles();
    say({ id: 'f-' + f.path, kind: 'agent', role, text: `Writing ${f.path}…`, tools: ['write_file'], file: f.path });
    const buildAsk = (retry) => {
      const siblings = [...filesMap.values()]
        .filter((x) => x.content && x.path !== f.path)
        .map((x) => `— ${x.path}:\n${x.content.slice(0, 4000)}`)
        .join('\n\n');
      return ask({
        id: 'f-' + f.path,
        role,
        system: SYS.builder(ROLE_META[role].name, f.path),
        user:
          `PROJECT: ${doc.title} — ${doc.description}\n` +
          `PROJECT FILE: ${f.path}\n\n` +
          `Planned files:\n${plan.files.map((p) => `- ${p.path} — ${p.purpose || ''}`).join('\n')}\n\n` +
          (knowledge ? `Project knowledge from the web (use for accurate details, naming and features):\n${knowledge.slice(0, 1800)}\n\n` : '') +
          (siblings ? `Already written files:\n${siblings}\n\n` : '') +
          (retry ? `IMPORTANT: your previous attempt returned an EMPTY file. Write the COMPLETE content of "${f.path}" now — real code/markup, no placeholders, no commentary.\n` : '') +
          `Write the complete content of "${f.path}" now. Output ONLY the raw file content — no markdown fences, no explanations.`,
        temperature: temp,
        onDelta: (_d, acc) => {
          entry.content = acc;
          entry.bytes = acc.length;
          emitFiles();
          say({ id: 'f-' + f.path, kind: 'agent', role, text: `Writing ${f.path}… ${(acc.length / 1024).toFixed(1)} KB`, tools: ['write_file'], file: f.path });
        },
      });
    };
    let outcome = 'template';
    try {
      outcome = await finalizeEntry({
        ask,
        entry,
        buildAsk,
        retryNote: () => say({ id: 'f-' + f.path, kind: 'agent', role, text: `${f.path} came back empty — retrying…`, tools: ['write_file'], file: f.path }),
        fallbackNote: () =>
          say({
            id: 'f-' + f.path,
            kind: 'agent',
            role,
            text: `⚠ ${f.path} stayed empty — inserted a working template so the project still runs. Ask for an upgrade and the team will write it properly.`,
            tools: ['write_file'],
            file: f.path,
            done: true,
          }),
        say,
        planFiles: plan.files,
        title: doc.title,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
    built++; // template files count — the project always ships runnable
    if (outcome === 'done') {
      say({
        id: 'f-' + f.path,
        kind: 'agent',
        role,
        text: `Wrote ${f.path} — ${entry.content.split('\n').length} lines.`,
        tools: ['write_file'],
        file: f.path,
        done: true,
      });
    }
    emitFiles();
  }
  if (!built) {
    emit({ status: 'error', error: 'No files could be built — check the agent errors or try another model.' });
    say({ id: 'sys-err', kind: 'sys', text: '⚠ Build failed — no files could be written.' });
    return doc;
  }

  // belt & braces: sweep for any remaining empty file → template
  for (const e of filesMap.values()) {
    if (!e.content || e.content.trim().length < MIN_FILE_CHARS) {
      e.content = fallbackFile(e.path, plan.files, doc.title);
      e.bytes = e.content.length;
      e.fallback = true;
      e.status = 'template';
    }
  }
  emitFiles();

  // ── 3 · TESTER 1 (read_files + run_checks) ─────────────────────────────────
  stage('test');
  emit({ status: 'testing' });
  let testReport = { verdict: 'pass', bugs: [] };
  try {
    const raw = await ask({
      id: 'tester',
      role: 'tester',
      system: SYS.tester('first'),
      user: `Project: ${doc.title} — ${doc.description}\n\n${manifestBlock([...filesMap.values()])}\n\n${fileBlocks([...filesMap.values()], 6000)}\n\nRun your checks (including: is any referenced file missing or empty?) and respond with the JSON verdict.`,
      temperature: 0.2,
      maxTokens: 900,
    });
    const parsed = extractJSON(raw);
    if (parsed && Array.isArray(parsed.bugs)) {
      testReport = {
        verdict: parsed.bugs.length ? 'issues' : 'pass',
        bugs: parsed.bugs.slice(0, 3).filter((b) => b && b.file),
      };
    }
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  emit({ testReport, status: testReport.bugs.length ? 'verifying' : 'documenting' });
  if (testReport.bugs.length) {
    say({
      id: 'tester',
      kind: 'agent',
      role: 'tester',
      text: `Found ${testReport.bugs.length} issue${testReport.bugs.length > 1 ? 's' : ''}:`,
      tools: ROLE_META.tester.tools,
      bugs: testReport.bugs.map((b) => ({ file: b.file, line: b.line, issue: b.issue })),
      done: true,
    });
  } else {
    say({ id: 'tester', kind: 'agent', role: 'tester', text: 'All checks passed — no bugs found. ✅', tools: ROLE_META.tester.tools, done: true });
  }

  // ── 4 · VERIFIER — Tester 2 (read_files + verify_bug) ──────────────────────
  if (testReport.bugs.length) {
    stage('verify');
    say({ id: 'verifier', kind: 'agent', role: 'verifier', text: `Verifying ${testReport.bugs.length} report${testReport.bugs.length > 1 ? 's' : ''}…`, tools: ROLE_META.verifier.tools });
    try {
      const bugList = testReport.bugs
        .map((b, i) => `${i + 1}. ${b.file}${b.line ? ':' + b.line : ''} — ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}`)
        .join('\n');
      const raw = await ask({
        id: 'verifier',
        role: 'verifier',
        system: SYS.verifier,
        user: `Project: ${doc.title}\n\nREPORTED BUGS:\n${bugList}\n\n${manifestBlock([...filesMap.values()])}\n\nProject files:\n${fileBlocks([...filesMap.values()], 6000)}\n\nVerify each report independently and respond with the JSON results.`,
        temperature: 0.2,
        maxTokens: 700,
      });
      const parsed = extractJSON(raw);
      const results = Array.isArray(parsed?.results) ? parsed.results : [];
      testReport.bugs.forEach((b, i) => {
        const r = results[i] && results[i].file === b.file ? results[i] : results.find((x) => x && x.file === b.file) || results[i] || null;
        if (r) {
          b.confirmed = !!r.confirmed;
          b.reason = String(r.reason || '').slice(0, 200);
        } else {
          b.confirmed = true; // no verdict → treat as confirmed, debugger will look
          b.reason = '';
        }
      });
      const confirmed = testReport.bugs.filter((b) => b.confirmed).length;
      const dismissed = testReport.bugs.length - confirmed;
      testReport.confirmed = confirmed;
      testReport.dismissed = dismissed;
      say({
        id: 'verifier',
        kind: 'agent',
        role: 'verifier',
        text: confirmed ? `Confirmed ${confirmed} bug${confirmed > 1 ? 's' : ''}${dismissed ? ` · dismissed ${dismissed} false alarm${dismissed > 1 ? 's' : ''}` : ''}.` : 'All reports were false alarms — nothing to fix.',
        tools: ROLE_META.verifier.tools,
        results: testReport.bugs.map((b) => ({ file: b.file, line: b.line, issue: b.issue, confirmed: b.confirmed, reason: b.reason })),
        done: true,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      testReport.bugs.forEach((b) => (b.confirmed = true));
      testReport.confirmed = testReport.bugs.length;
      say({ id: 'verifier', kind: 'agent', role: 'verifier', text: 'Verifier unavailable — passing all reports to the Debugger.', tools: ROLE_META.verifier.tools });
    }
    emit({ testReport, status: testReport.bugs.some((b) => b.confirmed) ? 'debugging' : 'documenting' });
  }

  // ── 5 · DEBUGGER (patch_file — confirmed bugs only) + 6 · RE-TEST ──────────
  const confirmedBugs = () => (testReport.bugs || []).filter((b) => b.confirmed);
  for (let round = 0; round < 2 && confirmedBugs().length; round++) {
    if (round === 0) stage('debug');
    else stage('retest'); // a re-test found something → second debug round
    emit({ status: 'debugging' });
    const bugs = confirmedBugs();
    say({
      id: round === 0 ? 'debugger' : 'debugger2',
      kind: 'agent',
      role: 'debugger',
      text: round === 0
        ? `Patching ${bugs.map((b) => b.file + (b.line ? ':' + b.line : '')).join(', ')}…`
        : `Patching what the re-test found: ${bugs.map((b) => b.file).join(', ')}…`,
      tools: ROLE_META.debugger.tools,
    });
    try {
      const bugBlock = bugs.map((b, i) => `${i + 1}. ${b.file}${b.line ? ':' + b.line : ''}: ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}${b.reason ? ` [verifier: ${b.reason}]` : ''}`).join('\n');
      const bugPaths = bugs.map((b) => b.file);
      const affected = [...filesMap.values()]
        .filter((f) => bugs.some((b) => b.file === f.path) && f.content)
        .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, 8000)}\n\`\`\``)
        .join('\n\n');
      const others = othersBlock([...filesMap.values()], bugPaths, 1200);
      const raw = await ask({
        id: round === 0 ? 'debugger' : 'debugger2',
        role: 'debugger',
        system: SYS.debugger,
        user: `Project: ${doc.title}\n\nConfirmed bugs:\n${bugBlock}\n\n${manifestBlock([...filesMap.values()])}\n\nCurrent files:\n${affected}${others ? `\n\nOTHER PROJECT FILES (context only — do not patch these):\n${others}` : ''}\n\nFix the bugs and respond with the JSON patch.`,
        temperature: 0.2,
        maxTokens,
      });
      const fix = extractJSON(raw);
      let applied = 0;
      for (const pf of fix?.files || []) {
        const e = filesMap.get(pf.path);
        if (e && typeof pf.content === 'string' && pf.content.length > 20) {
          e.content = pf.content;
          e.bytes = pf.content.length;
          e.status = 'patched';
          applied++;
        }
      }
      testReport = { ...testReport, applied: (testReport.applied || 0) + applied };
      say({
        id: round === 0 ? 'debugger' : 'debugger2',
        kind: 'agent',
        role: 'debugger',
        text: applied ? `Fixed! Patched ${applied} file${applied > 1 ? 's' : ''}.` : 'Reviewed — nothing needed patching.',
        tools: ROLE_META.debugger.tools,
        done: true,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      say({ id: round === 0 ? 'debugger' : 'debugger2', kind: 'agent', role: 'debugger', text: 'Could not patch — moving on.', tools: ROLE_META.debugger.tools, error: true });
    }
    emit({ testReport, status: 'retesting' });
    emitFiles();

    // re-test round
    stage('retest');
    emit({ status: 'retesting' });
    say({ id: 'retest', kind: 'agent', role: 'tester', text: 'Re-testing…', tools: ROLE_META.tester.tools });
    let rebugs = [];
    try {
      const raw = await ask({
        id: 'retest',
        role: 'tester',
        system: SYS.tester('retest'),
        user: `Project: ${doc.title}\n\nThe Debugger just patched the project. Re-run your checks.\n\n${manifestBlock([...filesMap.values()])}\n\n${fileBlocks([...filesMap.values()], 6000)}\n\nRespond with the JSON verdict.`,
        temperature: 0.2,
        maxTokens: 700,
      });
      const parsed = extractJSON(raw);
      if (parsed && Array.isArray(parsed.bugs)) rebugs = parsed.bugs.slice(0, 3).filter((b) => b && b.file);
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
    if (rebugs.length) {
      // carry only real, confirmed-looking leftovers into the next round
      testReport = { ...testReport, verdict: 'issues', bugs: rebugs.map((b) => ({ ...b, confirmed: true })) };
      say({ id: 'retest', kind: 'agent', role: 'tester', text: `Re-testing… still seeing ${rebugs.length} issue${rebugs.length > 1 ? 's' : ''} — Debugger, one more pass.`, tools: ROLE_META.tester.tools, done: true });
      emit({ testReport });
    } else {
      testReport = { ...testReport, verdict: 'pass', retest: 'pass', bugs: testReport.bugs };
      say({ id: 'retest', kind: 'agent', role: 'tester', text: 'Re-testing… all pass ✅', tools: ROLE_META.tester.tools, done: true });
      emit({ testReport, status: 'documenting' });
      break;
    }
  }

  // ── 7 · DOCUMENTER (write_readme) ──────────────────────────────────────────
  stage('docs');
  emit({ status: 'documenting' });
  try {
    const raw = await ask({
      id: 'documenter',
      role: 'documenter',
      system: SYS.documenter,
      user: `PROJECT: ${doc.title} — ${doc.description}\n\nFiles:\n${[...filesMap.values()].map((f) => `- ${f.path} (${f.bytes} bytes) — ${f.purpose || ''}`).join('\n')}\n\nWrite the README.md now.`,
      temperature: 0.4,
      maxTokens: 1200,
    });
    const content = stripFences(raw);
    filesMap.set('README.md', { path: 'README.md', purpose: 'documentation', content, status: 'done', by: 'Documenter', bytes: content.length });
    say({ id: 'documenter', kind: 'agent', role: 'documenter', text: 'README generated 📝', tools: ROLE_META.documenter.tools, done: true });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  emitFiles();

  // ── 8 · OPTIMIZER (perf_audit + final_report) ──────────────────────────────
  stage('report');
  emit({ status: 'reporting' });
  try {
    const raw = await ask({
      id: 'reporter',
      role: 'reporter',
      system: SYS.reporter,
      user: `PROJECT: ${doc.title} — ${doc.description}\n\nFiles: ${[...filesMap.values()].map((f) => f.path).join(', ')}\nBugs found: ${testReport.bugs?.length || 0} → confirmed: ${testReport.confirmed || 0} → patched: ${testReport.applied || 0} · re-test: ${testReport.retest === 'pass' ? 'all pass' : 'n/a'}.\n\nWrite the final report now.`,
      temperature: 0.4,
      maxTokens: 900,
    });
    const report = stripFences(raw);
    emit({ report });
    say({ id: 'reporter', kind: 'agent', role: 'reporter', text: 'Code optimized ⚡', md: report, tools: ROLE_META.reporter.tools, done: true });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }

  emit({ status: 'done' });
  say({ id: 'sys-done', kind: 'sys', text: `✅ ${doc.title || 'The app'} works — v1 shipped.` });
  return doc;
}

// ── upgrade pipeline ─────────────────────────────────────────────────────────
// Takes a finished project and a free-form user request ("add sound effects",
// "make it mobile friendly") and iterates: plan → modify/add files →
// re-test → verify → debug → "what changed" note. Bumps the project version.
// The whole run is narrated into the same chat transcript.
const SYS_UPGRADE_PLANNER = `You are the UPGRADE PLANNER (Coordinator) of the NexusAI project team. The user wants to change an EXISTING project.
YOUR JOB: decide exactly which files to touch.
YOUR TOOLS:
- analyze_request → fill "summary": one sentence of what you'll do
- plan_changes    → fill "changes": max 4 items; "modify" only for paths that already exist, "add" only for new paths that fit the project structure; never delete files
Respond ONLY valid JSON, no fences:
{"summary":"…","changes":[{"action":"modify"|"add","path":"…","instruction":"precise instruction for the file builder"}]}`;

const SYS_UPGRADE_BUILDER = (path, instruction) => `You are an UPGRADE BUILDER on the NexusAI project team.
YOUR JOB: apply this instruction to the file "${path}":
"${instruction}"
Preserve everything else that already works. The other project files are given for context — keep ids, classes, selectors and references consistent with them.
YOUR TOOLS:
- write_file(path) → your entire response IS the updated file content
Output ONLY the complete updated content of the file — no markdown fences, no commentary.`;

const SYS_UPGRADE_REPORT = `You are the OPTIMIZER of the NexusAI project team. An upgrade was just applied.
YOUR JOB: write a short "What changed" note for the user.
YOUR TOOLS: final_report → the note itself.
Markdown:
## What changed
- bullet per meaningful change
- one line on re-test results
Under 120 words. No fences.`;

export async function upgradeProject({ project, request, model, pool, keys, settings, signal, cb, web, webFetch }) {
  const ask = makeAsk({ model, pool, keys, settings, signal, onAgent: (a) => emitAgent(a) });
  const filesMap = new Map(
    (project.files || []).filter((f) => f.content).map((f) => [f.path, { ...f, status: 'done' }])
  );
  const agents = [];
  const version = (project.version || 1) + 1;

  const emit = (fields) => cb.onDoc?.(fields);
  const emitAgent = (a) => {
    const i = agents.findIndex((x) => x.id === a.id);
    if (i >= 0) agents[i] = a;
    else agents.push(a);
    emit({ agents: [...agents] });
  };
  const emitFiles = () => emit({ files: [...filesMap.values()] });
  const { chat: upChat, say } = makeChat(emit, project.chat || []);

  emit({ status: 'upgrading', upgradeNote: '🧠 Planning the upgrade…' });
  say({ id: 'u' + version, kind: 'user', text: String(request).slice(0, 600) });

  // ── 0 · RESEARCHER — web knowledge for the upgrade (optional) ─────────────
  let knowledge = '';
  if (web) {
    const query = researchQuery(String(request), 'project');
    say({ id: 'up-researcher', kind: 'agent', role: 'researcher', text: `Searching the web for “${query}”…`, tools: ROLE_META.researcher.tools });
    const rAgent = {
      id: 'up-researcher', role: 'researcher', name: 'Researcher',
      provider: 'web', model: 'search', status: 'running', text: '', ms: 0, note: null,
    };
    emitAgent({ ...rAgent });
    const t0 = performance.now();
    try {
      const w = await searchWeb(query, { signal, fetchImpl: webFetch, deep: true });
      knowledge = w.ok ? w.knowledge : '';
      emitAgent({ ...rAgent, status: 'done', ms: Math.round(performance.now() - t0), text: w.ok ? `${w.sources.length} sources` : 'no results' });
      say({
        id: 'up-researcher',
        kind: 'agent',
        role: 'researcher',
        text: w.ok ? `Found ${w.sources.length} sources${w.readCount ? ` · read ${w.readCount} pages live` : ''}:` : 'No web results — applying model knowledge.',
        tools: ROLE_META.researcher.tools,
        sources: w.sources.map((s) => ({ source: s.source, title: s.title, url: s.url, read: !!s.read })),
        read: w.readCount || 0,
        done: true,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      emitAgent({ ...rAgent, status: 'error', error: friendlyError(e), ms: Math.round(performance.now() - t0) });
      say({ id: 'up-researcher', kind: 'agent', role: 'researcher', text: 'Web search unavailable — applying model knowledge.', tools: ROLE_META.researcher.tools, done: true });
    }
  }

  say({ id: 'up-planner', kind: 'agent', role: 'coordinator', text: `Planning the upgrade to v${version}…`, tools: ROLE_META.coordinator.tools });

  // ── 1 · plan the change set ────────────────────────────────────────────────
  let plan = null;
  try {
    const fileList = [...filesMap.values()].map((f) => `- ${f.path}`).join('\n');
    const raw = await ask({
      id: 'up-planner',
      role: 'coordinator',
      system: SYS_UPGRADE_PLANNER,
      user: `UPGRADE REQUEST: ${String(request).slice(0, 600)}\n\nPROJECT: ${project.title} — ${project.description}\nCURRENT FILES:\n${fileList}${knowledge ? `\n\nWEB KNOWLEDGE (researched for this upgrade — use for accurate details and best practices):\n${knowledge.slice(0, 2500)}` : ''}`,
      temperature: 0.3,
      maxTokens: 700,
    });
    plan = extractJSON(raw);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  let changes = (plan?.changes || [])
    .filter((c) => c && typeof c.path === 'string' && (c.action === 'modify' || c.action === 'add'))
    .slice(0, 4);
  if (!changes.length) {
    const fallbackPath = [...filesMap.keys()].find((p) => /\.html?$/i.test(p)) || [...filesMap.keys()][0];
    if (fallbackPath) changes = [{ action: 'modify', path: fallbackPath, instruction: String(request).slice(0, 300) }];
  }
  const summary = String(plan?.summary || `Applying: ${request}`).slice(0, 200);
  emit({ upgradeNote: `🧠 v${version}: ${summary}` });
  say({
    id: 'up-planner',
    kind: 'agent',
    role: 'coordinator',
    text: `v${version} plan: ${summary}\nTouching ${changes.length} file${changes.length === 1 ? '' : 's'}: ${changes.map((c) => c.path).join(', ')}.`,
    tools: ROLE_META.coordinator.tools,
    done: true,
  });

  // ── 2 · apply each change (write_file per file) ────────────────────────────
  const changedPaths = [];
  for (const ch of changes) {
    const exists = filesMap.has(ch.path);
    if (ch.action === 'modify' && !exists) continue;
    if (ch.action === 'add' && exists) ch.action = 'modify';
    const ext = ch.path.split('.').pop().toLowerCase();
    const role = ['html', 'htm', 'css', 'svg'].includes(ext) ? 'designer' : 'coder';
    let entry = filesMap.get(ch.path);
    if (!entry) {
      entry = { path: ch.path, purpose: ch.instruction?.slice(0, 80) || 'added by upgrade', content: '', status: 'writing', by: ROLE_META[role].name, bytes: 0 };
      filesMap.set(ch.path, entry);
    }
    entry.status = 'writing';
    emitFiles();
    say({ id: 'up-' + ch.path, kind: 'agent', role, text: `${ch.action === 'add' ? 'Creating' : 'Updating'} ${ch.path}…`, tools: ['write_file'], file: ch.path });
    const buildAsk = (retry) => {
      const current = ch.action === 'modify' ? entry.content : '';
      const others = othersBlock([...filesMap.values()], [ch.path], 1500);
      return ask({
        id: 'up-' + ch.path,
        role,
        system: SYS_UPGRADE_BUILDER(ch.path, ch.instruction || String(request).slice(0, 300)),
        user:
          `PROJECT: ${project.title}\nUPGRADE REQUEST: ${String(request).slice(0, 400)}\n` +
          `FILE: ${ch.path} (${ch.action})\nINSTRUCTION: ${ch.instruction || String(request).slice(0, 300)}\n\n` +
          `${manifestBlock([...filesMap.values()])}\n\n` +
          (knowledge ? `WEB KNOWLEDGE for this change:\n${knowledge.slice(0, 1500)}\n\n` : '') +
          (others ? `OTHER PROJECT FILES (context — keep ids/classes/references consistent):\n${others}\n\n` : '') +
          (current ? `---CURRENT FILE CONTENT---\n${current.slice(0, 9000)}\n---END CURRENT FILE CONTENT---\n\n` : '') +
          (retry ? `IMPORTANT: your previous attempt returned an EMPTY file. Write the COMPLETE ${ch.action === 'add' ? 'new file' : 'updated file'} now — real code/markup, no placeholders.\n` : '') +
          `Output ONLY the complete ${ch.action === 'add' ? 'new file' : 'updated file'} content.`,
        temperature: 0.5,
        onDelta: (_d, acc) => {
          entry.content = acc;
          entry.bytes = acc.length;
          emitFiles();
          say({ id: 'up-' + ch.path, kind: 'agent', role, text: `${ch.action === 'add' ? 'Creating' : 'Updating'} ${ch.path}… ${(acc.length / 1024).toFixed(1)} KB`, tools: ['write_file'], file: ch.path });
        },
      });
    };
    const prevContent = ch.action === 'modify' ? entry.content : '';
    let outcome = 'template';
    try {
      outcome = await finalizeEntry({
        ask,
        entry,
        buildAsk,
        retryNote: () => say({ id: 'up-' + ch.path, kind: 'agent', role, text: `${ch.path} came back empty — retrying…`, tools: ['write_file'], file: ch.path }),
        fallbackNote: () =>
          say({
            id: 'up-' + ch.path,
            kind: 'agent',
            role,
            text: `⚠ ${ch.path} stayed empty — kept a working template. Try the upgrade again.`,
            tools: ['write_file'],
            file: ch.path,
            done: true,
          }),
        say,
        planFiles: [...filesMap.values()],
        title: project.title,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
    // a failed MODIFY must never destroy the previous working file — restore it
    if (outcome === 'template' && ch.action === 'modify' && prevContent && prevContent.trim().length >= MIN_FILE_CHARS) {
      entry.content = prevContent;
      entry.bytes = prevContent.length;
      entry.status = 'done';
      entry.fallback = false;
      say({
        id: 'up-' + ch.path,
        kind: 'agent',
        role,
        text: `⚠ Could not rewrite ${ch.path} — kept the previous v${version - 1} version untouched. Try the upgrade again.`,
        tools: ['write_file'],
        file: ch.path,
        done: true,
      });
    }
    if (outcome === 'done') {
      entry.touched = version;
      entry.by = ROLE_META[role].name;
      changedPaths.push(ch.path);
    }
    if (outcome === 'done') {
      say({
        id: 'up-' + ch.path,
        kind: 'agent',
        role,
        text: `${ch.action === 'add' ? 'Created' : 'Updated'} ${ch.path} — ${entry.content.split('\n').length} lines.`,
        tools: ['write_file'],
        file: ch.path,
        done: true,
      });
    }
    emitFiles();
  }

  // ── 3 · re-test changed files → verify → debug if needed ───────────────────
  if (changedPaths.length) {
    emit({ upgradeNote: '🧪 Re-testing the changes…' });
    say({ id: 'up-tester', kind: 'agent', role: 'tester', text: 'Re-testing the changes…', tools: ROLE_META.tester.tools });
    let testReport = { verdict: 'pass', bugs: [] };
    try {
      const filesBlock = changedPaths
        .map((p) => `### ${p}\n\`\`\`\n${String(filesMap.get(p)?.content || '').slice(0, 6000)}\n\`\`\``)
        .join('\n\n');
      const others = othersBlock([...filesMap.values()], changedPaths, 1500);
      const raw = await ask({
        id: 'up-tester',
        role: 'tester',
        system: SYS.tester('upgrade'),
        user: `Project: ${project.title}\nUPGRADE REQUEST: ${String(request).slice(0, 300)}\n\n${manifestBlock([...filesMap.values()])}\n\nChanged files:\n${filesBlock}${others ? `\n\nOTHER PROJECT FILES (context):\n${others}` : ''}\n\nRespond with the JSON verdict.`,
        temperature: 0.2,
        maxTokens: 800,
      });
      const parsed = extractJSON(raw);
      if (parsed && Array.isArray(parsed.bugs)) {
        testReport = { verdict: parsed.bugs.length ? 'issues' : 'pass', bugs: parsed.bugs.slice(0, 3).filter((b) => b && b.file) };
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
    if (testReport.bugs.length) {
      say({
        id: 'up-tester',
        kind: 'agent',
        role: 'tester',
        text: `Found ${testReport.bugs.length} issue${testReport.bugs.length > 1 ? 's' : ''} in the upgrade:`,
        tools: ROLE_META.tester.tools,
        bugs: testReport.bugs.map((b) => ({ file: b.file, line: b.line, issue: b.issue })),
        done: true,
      });
      // verifier pass on the upgrade's bugs
      try {
        const bugList = testReport.bugs.map((b, i) => `${i + 1}. ${b.file}${b.line ? ':' + b.line : ''} — ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}`).join('\n');
        const blocks = changedPaths.map((p) => `### ${p}\n\`\`\`\n${String(filesMap.get(p)?.content || '').slice(0, 6000)}\n\`\`\``).join('\n\n');
        const others = othersBlock([...filesMap.values()], changedPaths, 1500);
        const raw = await ask({
          id: 'up-verifier',
          role: 'verifier',
          system: SYS.verifier,
          user: `Project: ${project.title}\nUPGRADE REQUEST: ${String(request).slice(0, 200)}\n\nREPORTED BUGS:\n${bugList}\n\n${manifestBlock([...filesMap.values()])}\n\nChanged files:\n${blocks}${others ? `\n\nOTHER PROJECT FILES (context):\n${others}` : ''}\n\nVerify each report independently and respond with the JSON results.`,
          temperature: 0.2,
          maxTokens: 600,
        });
        const parsed = extractJSON(raw);
        const results = Array.isArray(parsed?.results) ? parsed.results : [];
        testReport.bugs.forEach((b, i) => {
          const r = results[i] || results.find((x) => x && x.file === b.file) || null;
          b.confirmed = r ? !!r.confirmed : true;
          b.reason = r ? String(r.reason || '').slice(0, 200) : '';
        });
        const confirmed = testReport.bugs.filter((b) => b.confirmed).length;
        testReport.confirmed = confirmed;
        say({
          id: 'up-verifier',
          kind: 'agent',
          role: 'verifier',
          text: confirmed ? `Confirmed ${confirmed} — Debugger is on it.` : 'All reports were false alarms — nothing to fix.',
          tools: ROLE_META.verifier.tools,
          results: testReport.bugs.map((b) => ({ file: b.file, line: b.line, issue: b.issue, confirmed: b.confirmed, reason: b.reason })),
          done: true,
        });
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        testReport.bugs.forEach((b) => (b.confirmed = true));
      }
      emit({ testReport });

      if (testReport.bugs.some((b) => b.confirmed)) {
        emit({ upgradeNote: '🔧 Fixing what the tester found…' });
        say({ id: 'up-debugger', kind: 'agent', role: 'debugger', text: 'Patching the confirmed bugs…', tools: ROLE_META.debugger.tools });
        try {
          const bugs = testReport.bugs.filter((b) => b.confirmed);
          const bugBlock = bugs.map((b, i) => `${i + 1}. ${b.file}${b.line ? ':' + b.line : ''}: ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}`).join('\n');
          const bugPaths = bugs.map((b) => b.file);
          const affected = bugs
            .map((b) => filesMap.get(b.file))
            .filter((f) => f?.content)
            .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, 8000)}\n\`\`\``)
            .join('\n\n');
          const others = othersBlock([...filesMap.values()], bugPaths, 1200);
          const raw = await ask({
            id: 'up-debugger',
            role: 'debugger',
            system: SYS.debugger,
            user: `Project: ${project.title}\nConfirmed bugs:\n${bugBlock}\n\n${manifestBlock([...filesMap.values()])}\n\nCurrent files:\n${affected}${others ? `\n\nOTHER PROJECT FILES (context only — do not patch these):\n${others}` : ''}\n\nFix and respond with the JSON patch.`,
            temperature: 0.2,
          });
          const fix = extractJSON(raw);
          let applied = 0;
          for (const pf of fix?.files || []) {
            const e = filesMap.get(pf.path);
            if (e && typeof pf.content === 'string' && pf.content.length > 20) {
              e.content = pf.content;
              e.bytes = pf.content.length;
              e.status = 'patched';
              applied++;
            }
          }
          testReport = { ...testReport, applied };
          say({ id: 'up-debugger', kind: 'agent', role: 'debugger', text: applied ? `Fixed! Patched ${applied} file${applied > 1 ? 's' : ''}.` : 'Reviewed — nothing needed patching.', tools: ROLE_META.debugger.tools, done: true });
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          say({ id: 'up-debugger', kind: 'agent', role: 'debugger', text: 'Could not patch — moving on.', tools: ROLE_META.debugger.tools, error: true });
        }
        emitFiles();
      }
    } else {
      say({ id: 'up-tester', kind: 'agent', role: 'tester', text: 'Re-testing… all pass ✅', tools: ROLE_META.tester.tools, done: true });
    }
    emit({ testReport });
  }

  // ── 4 · "what changed" note ────────────────────────────────────────────────
  emit({ upgradeNote: '⚡ Writing the change note…' });
  let note = '';
  try {
    const raw = await ask({
      id: 'up-reporter',
      role: 'reporter',
      system: SYS_UPGRADE_REPORT,
      user: `UPGRADE REQUEST: ${String(request).slice(0, 300)}\nSUMMARY: ${summary}\nFiles updated: ${changedPaths.join(', ') || 'none'}`,
      temperature: 0.4,
      maxTokens: 600,
    });
    note = stripFences(raw);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  say({ id: 'up-reporter', kind: 'agent', role: 'reporter', text: `Code optimized ⚡`, md: note || `Applied: ${summary}`, tools: ROLE_META.reporter.tools, done: true });

  const changelog = [
    ...(project.changelog || []),
    { version, request: String(request).slice(0, 140), summary: note || summary, ts: Date.now() },
  ];

  emit({
    status: 'done',
    upgradeNote: null,
    version,
    changelog,
    files: [...filesMap.values()],
  });
  say({ id: 'sys-up' + version, kind: 'sys', text: `✨ Upgraded to v${version} — ${changedPaths.length} file${changedPaths.length === 1 ? '' : 's'} touched.` });

  return {
    ...project,
    status: 'done',
    version,
    changelog,
    files: [...filesMap.values()],
    agents: [...agents],
    chat: [...upChat],
  };
}
