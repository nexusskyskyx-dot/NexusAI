// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Project Engine
//
//   👋 FRIEND greets → 💡 idea → 🧠 COORDINATOR plans (JSON: files & folders)
//   → 🎨 DESIGNER + 💻 CODER write every file (streamed into the explorer)
//   → 🧪 TESTER reviews → 🔧 DEBUGGER patches → 📝 DOCUMENTER writes README
//   → ⚡ OPTIMIZER ships the final report. Live preview assembles itself.
//
// Every agent fails over to the next model in the pool, exactly like the chat
// team. The offline demo provider can play every role, so the whole pipeline
// runs with zero keys and zero network.
// ─────────────────────────────────────────────────────────────────────────────
import { streamChat, friendlyError } from './ai.js';
import { modelLabel } from '@shared/providers.js';
import { CONSOLE_SHIM } from './preview.js';

export const PROJECT_STAGES = [
  { id: 'plan', label: 'Plan', glyph: '🧠', desc: 'Coordinator breaks the idea into files' },
  { id: 'build', label: 'Build', glyph: '💻', desc: 'Designer & Coder write every file' },
  { id: 'test', label: 'Test', glyph: '🧪', desc: 'Tester hunts for bugs' },
  { id: 'debug', label: 'Debug', glyph: '🔧', desc: 'Debugger patches the issues' },
  { id: 'docs', label: 'Docs', glyph: '📝', desc: 'Documenter writes the README' },
  { id: 'report', label: 'Report', glyph: '⚡', desc: 'Optimizer delivers the final report' },
];

export const ROLE_META = {
  coordinator: { glyph: '🧠', name: 'Coordinator' },
  designer: { glyph: '🎨', name: 'Designer' },
  coder: { glyph: '💻', name: 'Coder' },
  tester: { glyph: '🧪', name: 'Tester' },
  debugger: { glyph: '🔧', name: 'Debugger' },
  documenter: { glyph: '📝', name: 'Documenter' },
  reporter: { glyph: '⚡', name: 'Optimizer' },
};

const SYS = {
  coordinator: `You are the COORDINATOR of the NexusAI project team. Turn the user's idea into a build plan for a small, self-contained web project (plain HTML/CSS/JS only — no build tools, no npm, no frameworks).
Respond with ONLY valid JSON, no markdown fences:
{"title":"short project name","description":"one sentence","stack":["html","css","js"],"files":[{"path":"index.html","purpose":"…"}],"steps":["…"]}
Rules: 3-6 files, use folders like css/ and js/ when a file type repeats, include README.md as the last file, lowercase paths, no spaces.`,
  builder: (role, path) => `You are a FILE BUILDER (${role}) on the NexusAI project team. Write the COMPLETE content of the file "${path}".
Rules: output ONLY the raw file content — no markdown fences, no commentary, no explanations. Make it polished, complete and production-quality.`,
  tester: `You are the TESTER of the NexusAI project team. Review the project files for real bugs: broken file references, JS runtime errors, CSS selectors matching nothing, missing DOM ids, unusable UI.
Respond ONLY valid JSON, no fences:
{"verdict":"pass"|"issues","bugs":[{"file":"path","issue":"…","fix":"…"}]}
Max 3 genuine bugs. If nothing is broken, verdict is "pass" with an empty bugs array.`,
  debugger: `You are the DEBUGGER of the NexusAI project team. You receive reported bugs and the current file contents. Fix them.
Respond ONLY valid JSON, no fences:
{"files":[{"path":"…","content":"full fixed file content"}]}
Return every file you changed with its complete corrected content. Change nothing else.`,
  documenter: `You are the DOCUMENTER of the NexusAI project team. Write a README.md for the finished project: what it is, how to run it, file structure table, features. Rich Markdown, under 200 words. Output ONLY the raw markdown, no fences.`,
  reporter: `You are the OPTIMIZER of the NexusAI project team. Produce the FINAL REPORT for the user in rich Markdown with exactly these sections:
## What was built
## Structure
## Quality (bugs found & fixed)
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
    byPath.get('index.html') ||
    files.find((f) => /\.html?$/i.test(f.path) && f.content)?.content ||
    '<div style="font-family:system-ui;padding:40px;color:#888">Waiting for index.html…</div>';

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

// ── the runner ───────────────────────────────────────────────────────────────
// runProject({ idea, model:{provider,model}, pool, keys, settings, signal, cb })
// cb.onDoc(fields) receives shallow doc patches (throttle-friendly).
// Returns the final doc snapshot.
export async function runProject({ idea, model, pool, keys, settings, signal, cb }) {
  const temp = typeof settings?.temperature === 'number' ? settings.temperature : 0.7;
  const maxTokens = settings?.maxTokens || 4000;

  const doc = {
    title: '',
    description: '',
    plan: null,
    files: [],
    stages: [],
    agents: [],
    testReport: null,
    report: null,
    status: 'planning',
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

  // resilient ask with failover across the pool
  const ask = makeAsk({ model, pool, keys, settings, signal, onAgent: emitAgent });

  // ── 1 · COORDINATOR ────────────────────────────────────────────────────────
  stage('plan');
  let plan = null;
  try {
    const raw = await ask({
      id: 'coordinator',
      role: 'coordinator',
      system: SYS.coordinator,
      user: `PROJECT IDEA:\n${String(idea).slice(0, 2000)}`,
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
  emit({
    title: String(plan.title || titleFromIdea(idea)).slice(0, 80),
    description: String(plan.description || '').slice(0, 300),
    plan,
    status: 'building',
  });

  // ── 2 · BUILDERS (Designer / Coder) ────────────────────────────────────────
  stage('build');
  let built = 0;
  for (const f of plan.files) {
    if (/readme\.md$/i.test(f.path)) continue; // documenter writes it later
    const ext = f.path.split('.').pop().toLowerCase();
    const role = ['html', 'htm', 'css', 'svg'].includes(ext) ? 'designer' : 'coder';
    const entry = { path: f.path, purpose: f.purpose || '', content: '', status: 'writing', by: ROLE_META[role].name, bytes: 0 };
    filesMap.set(f.path, entry);
    emitFiles();
    try {
      const siblings = [...filesMap.values()]
        .filter((x) => x.content && x.path !== f.path)
        .map((x) => `— ${x.path}:\n${x.content.slice(0, 2500)}`)
        .join('\n\n');
      const raw = await ask({
        id: 'f-' + f.path,
        role,
        system: SYS.builder(ROLE_META[role].name, f.path),
        user:
          `PROJECT: ${doc.title} — ${doc.description}\n` +
          `PROJECT FILE: ${f.path}\n\n` +
          `Planned files:\n${plan.files.map((p) => `- ${p.path} — ${p.purpose || ''}`).join('\n')}\n\n` +
          (siblings ? `Already written files:\n${siblings}\n\n` : '') +
          `Write the complete content of "${f.path}" now. Output ONLY the raw file content — no markdown fences, no explanations.`,
        temperature: temp,
        onDelta: (_d, acc) => {
          entry.content = acc;
          entry.bytes = acc.length;
          emitFiles();
        },
      });
      entry.content = stripFences(raw);
      entry.bytes = entry.content.length;
      entry.status = 'done';
      built++;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      entry.status = 'error';
      entry.error = friendlyError(e);
    }
    emitFiles();
  }
  if (!built) {
    emit({ status: 'error', error: 'No files could be built — check the agent errors or try another model.' });
    return doc;
  }

  // ── 3 · TESTER ─────────────────────────────────────────────────────────────
  stage('test');
  emit({ status: 'testing' });
  let testReport = { verdict: 'pass', bugs: [] };
  try {
    const filesBlock = [...filesMap.values()]
      .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, 4000)}\n\`\`\``)
      .join('\n\n');
    const raw = await ask({
      id: 'tester',
      role: 'tester',
      system: SYS.tester,
      user: `Project: ${doc.title} — ${doc.description}\n\n${filesBlock}\n\nReview the files and respond with the JSON verdict.`,
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
  emit({ testReport, status: testReport.bugs.length ? 'debugging' : 'documenting' });

  // ── 4 · DEBUGGER (only if bugs) ────────────────────────────────────────────
  if (testReport.bugs.length) {
    stage('debug');
    try {
      const bugBlock = testReport.bugs.map((b, i) => `${i + 1}. ${b.file}: ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}`).join('\n');
      const affected = [...filesMap.values()]
        .filter((f) => testReport.bugs.some((b) => b.file === f.path) && f.content)
        .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, 6000)}\n\`\`\``)
        .join('\n\n');
      const raw = await ask({
        id: 'debugger',
        role: 'debugger',
        system: SYS.debugger,
        user: `Project: ${doc.title}\n\nReported bugs:\n${bugBlock}\n\nCurrent files:\n${affected}\n\nFix the bugs and respond with the JSON patch.`,
        temperature: 0.2,
        maxTokens: maxTokens,
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
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
    emit({ testReport, status: 'documenting' });
    emitFiles();
  }

  // ── 5 · DOCUMENTER ─────────────────────────────────────────────────────────
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
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }
  emitFiles();

  // ── 6 · OPTIMIZER → final report ───────────────────────────────────────────
  stage('report');
  emit({ status: 'reporting' });
  try {
    const raw = await ask({
      id: 'reporter',
      role: 'reporter',
      system: SYS.reporter,
      user: `PROJECT: ${doc.title} — ${doc.description}\n\nFiles: ${[...filesMap.values()].map((f) => f.path).join(', ')}\nBugs found: ${testReport.bugs.length}, patched: ${testReport.applied || 0}.\n\nWrite the final report now.`,
      temperature: 0.4,
      maxTokens: 900,
    });
    emit({ report: stripFences(raw) });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
  }

  emit({ status: 'done' });
  return doc;
}

// ── upgrade pipeline ─────────────────────────────────────────────────────────
// Takes a finished project and a free-form user request ("add sound effects",
// "make it mobile friendly") and iterates: plan → modify/add files →
// re-test → debug → "what changed" note. Bumps the project version.
const SYS_UPGRADE_PLANNER = `You are the UPGRADE PLANNER of the NexusAI project team. The user wants to change an EXISTING project. Given the request and the current file list, respond ONLY valid JSON, no fences:
{"summary":"one sentence of what you'll do","changes":[{"action":"modify"|"add","path":"existing-or-new-file","instruction":"precise instruction for the file builder"}]}
Rules: max 4 changes, "modify" only for paths that already exist, "add" only for new paths that fit the project structure, never delete files.`;

const SYS_UPGRADE_BUILDER = (path, instruction) => `You are an UPGRADE BUILDER on the NexusAI project team. Apply this instruction to the file "${path}":
"${instruction}"
Preserve everything else that already works. Output ONLY the complete updated content of the file — no markdown fences, no commentary.`;

const SYS_UPGRADE_REPORT = `You are the OPTIMIZER of the NexusAI project team. An upgrade was just applied to the project. Write a short "What changed" note for the user in Markdown:
## What changed
- bullet per meaningful change
- one line on re-test results
Under 120 words. No fences.`;

export async function upgradeProject({ project, request, model, pool, keys, settings, signal, cb }) {
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

  emit({ status: 'upgrading', upgradeNote: '🧠 Planning the upgrade…' });

  // ── 1 · plan the change set ────────────────────────────────────────────────
  let plan = null;
  try {
    const fileList = [...filesMap.values()].map((f) => `- ${f.path}`).join('\n');
    const raw = await ask({
      id: 'up-planner',
      role: 'coordinator',
      system: SYS_UPGRADE_PLANNER,
      user: `UPGRADE REQUEST: ${String(request).slice(0, 600)}\n\nPROJECT: ${project.title} — ${project.description}\nCURRENT FILES:\n${fileList}`,
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
  emit({ upgradeNote: `🧠 ${summary}` });

  // ── 2 · apply each change ──────────────────────────────────────────────────
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
    try {
      const current = ch.action === 'modify' ? entry.content : '';
      const raw = await ask({
        id: 'up-' + ch.path,
        role,
        system: SYS_UPGRADE_BUILDER(ch.path, ch.instruction || String(request).slice(0, 300)),
        user:
          `PROJECT: ${project.title}\nUPGRADE REQUEST: ${String(request).slice(0, 400)}\n` +
          `FILE: ${ch.path} (${ch.action})\nINSTRUCTION: ${ch.instruction || String(request).slice(0, 300)}\n\n` +
          (current ? `---CURRENT FILE CONTENT---\n${current.slice(0, 9000)}\n---END CURRENT FILE CONTENT---\n\n` : '') +
          `Output ONLY the complete ${ch.action === 'add' ? 'new file' : 'updated file'} content.`,
        temperature: 0.5,
        onDelta: (_d, acc) => {
          entry.content = acc;
          entry.bytes = acc.length;
          emitFiles();
        },
      });
      entry.content = stripFences(raw);
      entry.bytes = entry.content.length;
      entry.status = 'done';
      entry.touched = version;
      entry.by = ROLE_META[role].name;
      changedPaths.push(ch.path);
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      entry.status = 'error';
      entry.error = friendlyError(e);
    }
    emitFiles();
  }

  // ── 3 · re-test changed files, debug if needed ─────────────────────────────
  if (changedPaths.length) {
    emit({ upgradeNote: '🧪 Re-testing the changes…' });
    let testReport = { verdict: 'pass', bugs: [] };
    try {
      const filesBlock = changedPaths
        .map((p) => `### ${p}\n\`\`\`\n${String(filesMap.get(p)?.content || '').slice(0, 4000)}\n\`\`\``)
        .join('\n\n');
      const raw = await ask({
        id: 'up-tester',
        role: 'tester',
        system: SYS.tester,
        user: `Project: ${project.title}\nUPGRADE REQUEST: ${String(request).slice(0, 300)}\n\nChanged files:\n${filesBlock}\n\nRespond with the JSON verdict.`,
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
      emit({ upgradeNote: '🔧 Fixing what the tester found…' });
      try {
        const bugBlock = testReport.bugs.map((b, i) => `${i + 1}. ${b.file}: ${b.issue}${b.fix ? ` (suggested fix: ${b.fix})` : ''}`).join('\n');
        const affected = testReport.bugs
          .map((b) => filesMap.get(b.file))
          .filter((f) => f?.content)
          .map((f) => `### ${f.path}\n\`\`\`\n${String(f.content).slice(0, 6000)}\n\`\`\``)
          .join('\n\n');
        const raw = await ask({
          id: 'up-debugger',
          role: 'debugger',
          system: SYS.debugger,
          user: `Project: ${project.title}\nReported bugs:\n${bugBlock}\n\nCurrent files:\n${affected}\n\nFix and respond with the JSON patch.`,
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
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
      }
      emitFiles();
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

  return {
    ...project,
    status: 'done',
    version,
    changelog,
    files: [...filesMap.values()],
    agents: [...agents],
  };
}
