// End-to-end smoke test of the NexusAI multi-agent engine against the demo provider.
// Usage: node scripts/smoke.mjs   (server must be running on :8787)
globalThis.__NEXUS_PROXY_BASE = 'http://localhost:8787';

const { runTeam } = await import('../src/lib/engine.js');
const { streamChat } = await import('../src/lib/ai.js');

// 1 · solo stream through the proxy
let soloText = '';
const solo = await streamChat({
  provider: 'demo',
  model: 'nexus-demo',
  messages: [{ role: 'user', content: 'hello nexus' }],
  system: 'You are NexusAI.',
  onDelta: (d) => (soloText += d),
});
console.log(`[1] solo stream ok — ${solo.text.length} chars (acc ${soloText.length})`);

// 2 · full team run
let stageEvents = 0;
let agentEvents = 0;
let finalStreamed = '';
const t0 = Date.now();
const result = await runTeam({
  messages: [{ role: 'user', content: 'build me a neon landing page' }],
  cfg: {
    workers: [
      { provider: 'demo', model: 'nexus-demo' },
      { provider: 'demo', model: 'nexus-demo' },
    ],
    planner: { provider: 'demo', model: 'nexus-demo' },
    critic: { provider: 'demo', model: 'nexus-demo' },
    synth: { provider: 'demo', model: 'nexus-demo' },
    settings: { temperature: 0.7, maxTokens: 600, planner: true, critic: true, stagger: false, transport: 'proxy' },
    keys: {},
  },
  cb: {
    onStage: () => stageEvents++,
    onAgent: () => agentEvents++,
    onFinalDelta: (d) => (finalStreamed += d),
  },
});
console.log(`[2] team run ok in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`    stages=${stageEvents} agentEvents=${agentEvents} verdict=${result.verdict}`);
console.log(`    agents: ${result.agents.map((a) => `${a.role}:${a.status}`).join(' ')}`);
console.log(`    final=${result.finalText.length} chars (streamed ${finalStreamed.length})`);
const roles = new Set(result.agents.map((a) => a.role));
if (![...roles].includes('planner') || ![...roles].includes('worker') || ![...roles].includes('critic') || ![...roles].includes('synth')) {
  throw new Error('missing agent roles: ' + [...roles].join(','));
}
if (result.finalText.length < 200) throw new Error('final answer too short');
if (finalStreamed !== result.finalText) throw new Error('streamed text != final text');

// 3 · graceful degradation — one worker fails (bad provider), run continues
const r3 = await runTeam({
  messages: [{ role: 'user', content: 'test degradation' }],
  cfg: {
    workers: [
      { provider: 'nonexistent-provider', model: 'x' },
      { provider: 'demo', model: 'nexus-demo' },
    ],
    planner: null,
    critic: null,
    synth: { provider: 'demo', model: 'nexus-demo' },
    settings: { temperature: 0.5, maxTokens: 400, planner: false, critic: false, stagger: false, transport: 'proxy' },
    keys: {},
  },
  cb: {},
});
console.log(`[3] degradation ok — agents: ${r3.agents.map((a) => `${a.role}:${a.status}`).join(' ')}`);

// 4 · abort
const ctl = new AbortController();
setTimeout(() => ctl.abort(), 250);
let aborted = false;
try {
  await streamChat({
    provider: 'demo',
    model: 'nexus-demo',
    messages: [{ role: 'user', content: 'hello' }],
    signal: ctl.signal,
    onDelta: () => {},
  });
} catch (e) {
  aborted = e.name === 'AbortError';
}
console.log(`[4] abort ${aborted ? 'ok' : 'FAILED'}`);

// 5 · automatic failover — a dead drafter must switch to a pool model and finish
const r5 = await runTeam({
  messages: [{ role: 'user', content: 'test failover' }],
  cfg: {
    workers: [{ provider: 'nope', model: 'dead-model' }],
    planner: null,
    critic: null,
    synth: { provider: 'demo', model: 'nexus-demo' },
    pool: [
      { provider: 'also-dead', model: 'x' },
      { provider: 'demo', model: 'nexus-demo' },
    ],
    settings: { temperature: 0.5, maxTokens: 400, planner: false, critic: false, stagger: false, transport: 'proxy' },
    keys: {},
  },
  cb: {},
});
const worker5 = r5.agents.find((a) => a.role === 'worker');
console.log(`[5] failover — worker status=${worker5.status} provider=${worker5.provider} note=${JSON.stringify(worker5.note)}`);
if (worker5.status !== 'done' || worker5.provider !== 'demo') throw new Error('failover did not recover the worker');
if (r5.finalText.length < 100) throw new Error('failover produced no final answer');

// 6 · full project pipeline (offline demo): coordinator → builders → tester →
//     debugger → documenter → report, with a real bug found & patched
const { runProject, assemblePreview, extractJSON } = await import('../src/lib/projects.js');
const { makeZip } = await import('../src/lib/zip.js');
const t6 = Date.now();
const doc6 = await runProject({
  idea: 'a neon pomodoro timer app',
  model: { provider: 'demo', model: 'nexus-demo' },
  pool: [{ provider: 'demo', model: 'nexus-demo' }],
  keys: {},
  settings: { transport: 'proxy', temperature: 0.5, maxTokens: 900 },
  signal: new AbortController().signal,
  cb: {},
});
console.log(`[6] project — status=${doc6.status} title="${doc6.title}" in ${((Date.now() - t6) / 1000).toFixed(1)}s`);
console.log(`    files: ${doc6.files.map((f) => `${f.path}(${f.status})`).join(' ')}`);
console.log(`    stages: ${doc6.stages.join('→')}`);
console.log(`    bugs: ${doc6.testReport?.bugs?.length} · confirmed: ${doc6.testReport?.confirmed} · dismissed: ${doc6.testReport?.dismissed} · patched: ${doc6.testReport?.applied} · retest: ${doc6.testReport?.retest}`);
if (doc6.status !== 'done') throw new Error('project did not finish');
if (doc6.stages.join('→') !== 'plan→build→test→verify→debug→retest→docs→report') throw new Error('stage order wrong: ' + doc6.stages.join('→'));
if (!doc6.files.some((f) => f.path === 'index.html' && f.content)) throw new Error('no index.html');
if (!doc6.files.some((f) => f.path === 'README.md')) throw new Error('no README');
if (doc6.testReport?.bugs?.length !== 2) throw new Error('tester should report 2 bugs (1 real + 1 false alarm), got ' + doc6.testReport?.bugs?.length);
if (doc6.testReport.confirmed !== 1 || doc6.testReport.dismissed !== 1) throw new Error('verifier did not split confirmed/dismissed');
const realBug = doc6.testReport.bugs.find((b) => b.file === 'js/app.js');
const fakeBug = doc6.testReport.bugs.find((b) => b.file === 'css/style.css');
if (!realBug || realBug.confirmed !== true || typeof realBug.line !== 'number' || realBug.line < 1) throw new Error('real bug not confirmed with a line number');
if (!fakeBug || fakeBug.confirmed !== false) throw new Error('false alarm not dismissed by the verifier');
if (doc6.testReport.applied !== 1) throw new Error('debugger applied wrong patch count');
if (doc6.testReport.retest !== 'pass') throw new Error('re-test did not pass');
const css6 = doc6.files.find((f) => f.path === 'css/style.css');
if (css6 && css6.status === 'patched') throw new Error('debugger touched the dismissed bug — must not happen');
if (!doc6.report || doc6.report.length < 80) throw new Error('no final report');
const patched = doc6.files.find((f) => f.path === 'js/app.js');
if (patched && /console\.log\('clicked'/.test(patched.content)) throw new Error('bug not actually fixed');
// chat transcript: the whole story must be narrated
const roles6 = new Set((doc6.chat || []).filter((m) => m.kind === 'agent').map((m) => m.role));
for (const r of ['coordinator', 'designer', 'coder', 'tester', 'verifier', 'debugger', 'documenter', 'reporter']) {
  if (!roles6.has(r)) throw new Error('chat missing agent: ' + r);
}
if (!(doc6.chat || []).some((m) => m.kind === 'user')) throw new Error('chat missing the user message');
if (!(doc6.chat || []).some((m) => m.kind === 'sys')) throw new Error('chat missing the final system message');
const testerMsg = (doc6.chat || []).find((m) => m.role === 'tester' && m.id === 'tester');
if (!testerMsg?.bugs?.length) throw new Error('tester chat message missing bug list');
if (!(doc6.chat || []).some((m) => m.role === 'verifier' && m.results?.some((r) => r.confirmed === true && r.confirmed !== undefined && r.reason))) throw new Error('verifier chat message missing results');
const toolMsg = (doc6.chat || []).find((m) => m.tools?.includes('write_file'));
if (!toolMsg) throw new Error('no chat message shows tool usage');
const preview = assemblePreview(doc6.files);
if (!preview.includes('css/style.css') || preview.includes('href="css/style.css"')) {
  // css must be inlined (style tag) not left as a link
  if (preview.includes('href="css/style.css"')) throw new Error('preview did not inline css');
}
if (!/<style>[\s\S]*body/.test(preview)) throw new Error('preview missing styles');
const zip = makeZip(doc6.files.map((f) => ({ path: f.path, content: f.content })));
const zipBytes = await zip.arrayBuffer();
const zipU8 = new Uint8Array(zipBytes);
if (zipU8[0] !== 0x50 || zipU8[1] !== 0x4b) throw new Error('zip magic bytes wrong');
if (new DataView(zipBytes).getUint32(zipBytes.byteLength - 22, true) !== 0x06054b50) throw new Error('zip EOCD wrong');
console.log(`    preview ok (${preview.length} chars) · zip ok (${zip.size} bytes)`);

// 7 · upgrade pipeline — type a change request, the team iterates the project
const { upgradeProject } = await import('../src/lib/projects.js');
const doc7 = await upgradeProject({
  project: doc6,
  request: 'add sound effects and a dark theme',
  model: { provider: 'demo', model: 'nexus-demo' },
  pool: [{ provider: 'demo', model: 'nexus-demo' }],
  keys: {},
  settings: { transport: 'proxy', temperature: 0.5, maxTokens: 900 },
  signal: new AbortController().signal,
  cb: {},
});
console.log(`[7] upgrade — status=${doc7.status} version=${doc7.version} changelog=${doc7.changelog.length}`);
console.log(`    changed: ${doc7.files.filter((f) => f.touched === 2).map((f) => f.path).join(', ')}`);
if (doc7.status !== 'done') throw new Error('upgrade did not finish');
if (doc7.version !== 2) throw new Error('version not bumped');
if (doc7.changelog.length !== 1 || !doc7.changelog[0].summary) throw new Error('changelog entry missing');
const js7 = doc7.files.find((f) => f.path === 'js/app.js');
if (!js7 || !/upgrade applied/.test(js7.content)) throw new Error('js file not upgraded');
if (!/console\.log\('App ready'\)/.test(js7.content)) throw new Error('upgrade destroyed existing content');
const html7 = doc7.files.find((f) => f.path === 'index.html');
if (!html7 || !/<\/html>/i.test(html7.content)) throw new Error('upgrade destroyed html');
const upUser = (doc7.chat || []).filter((m) => m.kind === 'user');
if (upUser.length < 1) throw new Error('upgrade chat missing the user message');
if (!(doc7.chat || []).some((m) => m.id === 'up-planner' && m.done)) throw new Error('upgrade chat missing planner message');
console.log(`    v1 content preserved + v2 patches applied ✓`);

// 8 · web research — the Researcher searches the web and feeds every agent
const { searchWeb } = await import('../src/lib/websearch.js');
const fakeFetch = async (url) => {
  if (url.includes('api.github.com'))
    return { ok: true, json: async () => ({ items: [{ full_name: 'nexus/demo-app', stargazers_count: 42, description: 'a demo app', html_url: 'https://github.com/nexus/demo-app' }] }) };
  if (url.includes('duckduckgo.com'))
    return { ok: true, json: async () => ({ Heading: 'Pomodoro', AbstractText: 'The pomodoro technique is a time management method.', AbstractURL: 'https://ddg/pomodoro' }) };
  if (url.includes('list=search'))
    return { ok: true, json: async () => ({ query: { search: [{ title: 'Pomodoro Technique' }] } }) };
  return { ok: true, json: async () => ({ query: { pages: { '1': { title: 'Pomodoro Technique', extract: 'The Pomodoro Technique uses a timer to break work into intervals.' } } } }) };
};
const web8 = await searchWeb('build a pomodoro timer app', { fetchImpl: fakeFetch });
console.log(`[8] web research — ok=${web8.ok} sources=${web8.sources.length} (${web8.sources.map((s) => s.source).join(',')})`);
if (!web8.ok || web8.sources.length < 3) throw new Error('searchWeb returned too few sources');
if (!/Pomodoro Technique uses a timer/.test(web8.knowledge)) throw new Error('wikipedia extract missing from knowledge');
if (!/time management method/.test(web8.knowledge)) throw new Error('duckduckgo answer missing from knowledge');
if (!/nexus\/demo-app/.test(web8.knowledge)) throw new Error('github reference missing from knowledge');

// team run with the researcher stage
const r8 = await runTeam({
  messages: [{ role: 'user', content: 'tell me about the pomodoro technique' }],
  cfg: {
    workers: [{ provider: 'demo', model: 'nexus-demo' }],
    planner: null, critic: null,
    synth: { provider: 'demo', model: 'nexus-demo' },
    pool: [], keys: {},
    settings: { transport: 'proxy', maxTokens: 400, web: true },
    webFetch: fakeFetch,
  },
  cb: {},
});
const researcher8 = r8.agents.find((a) => a.role === 'researcher');
console.log(`    team: researcher=${researcher8?.status} webSources=${r8.webSources?.length} final=${r8.finalText.length} chars`);
if (researcher8?.status !== 'done') throw new Error('researcher agent did not finish');
if (!r8.webSources?.length) throw new Error('team result missing webSources');
if (r8.finalText.length < 100) throw new Error('team final answer missing');

// project run with web knowledge
const doc8 = await runProject({
  idea: 'a pomodoro timer web app',
  model: { provider: 'demo', model: 'nexus-demo' },
  pool: [{ provider: 'demo', model: 'nexus-demo' }],
  keys: {},
  settings: { transport: 'proxy', temperature: 0.5, maxTokens: 900 },
  signal: new AbortController().signal,
  cb: {},
  web: true,
  webFetch: fakeFetch,
});
const resMsg8 = (doc8.chat || []).find((m) => m.id === 'researcher');
console.log(`    project: stage0=${doc8.stages[0]} researcherMsg=${resMsg8 ? 'yes' : 'no'} sources=${resMsg8?.sources?.length || 0}`);
if (doc8.stages[0] !== 'research') throw new Error('project missing research stage');
if (!resMsg8 || !resMsg8.sources?.length) throw new Error('project chat missing researcher sources');
if (doc8.status !== 'done') throw new Error('project with web research did not finish');

// 9 · researcher domain-matching + full file visibility
const { researchQuery } = await import('../src/lib/websearch.js');
const q9a = researchQuery('Make a professional portfolio', 'project');
const q9b = researchQuery('what is a financial portfolio?', 'chat');
const q9c = researchQuery('a neon pomodoro timer app', 'project');
console.log(`[9] research queries — build: "${q9a}" · literal: "${q9b}" · subject: "${q9c}"`);
if (!/web design/.test(q9a) || !/portfolio/.test(q9a)) throw new Error('portfolio did not resolve to its web-design sense');
if (/american|money|capital|stock|invest/i.test(q9a)) throw new Error('finance sense leaked into a build query');
if (!/financial portfolio/.test(q9b) || /web design/.test(q9b)) throw new Error('literal finance question was wrongly rewritten');
if (!/pomodoro/.test(q9c)) throw new Error('subject lost from project query');

// the demo tester must see missing referenced files (full file visibility)
const { demoResponse } = await import('../server/demo.js');
const t9 = JSON.parse(
  demoResponse({
    messages: [
      { role: 'system', content: 'You are the TESTER of the NexusAI project team.' },
      {
        role: 'user',
        content:
          'Project: X\n\nPROJECT MANIFEST (every file and its state):\n- index.html — written · 400 bytes\n- css/style.css — MISSING / EMPTY\n\n### index.html\n```\n<link rel="stylesheet" href="css/style.css">\n<script src="js/app.js"></script>\n```\n\nRespond with the JSON verdict.',
      },
    ],
  })
);
const missing9 = t9.bugs.filter((b) => /MISSING|empty/i.test(b.issue));
console.log(`    missing-file detection: ${missing9.map((b) => b.file).join(', ')}`);
if (!missing9.some((b) => b.file === 'css/style.css')) throw new Error('tester did not report the missing stylesheet');
if (!missing9.some((b) => b.file === 'js/app.js')) throw new Error('tester did not report the missing script');
const v9 = JSON.parse(
  demoResponse({
    messages: [
      { role: 'system', content: 'You are the VERIFIER (second, independent tester) of the NexusAI project team.' },
      {
        role: 'user',
        content:
          'Project: X\n\nREPORTED BUGS:\n1. css/style.css:1 — referenced by the project but MISSING or empty\n\n### index.html\n```\n<link rel="stylesheet" href="css/style.css">\n```\n\nVerify each report independently and respond with the JSON results.',
      },
    ],
  })
);
if (!v9.results?.[0]?.confirmed) throw new Error('verifier dismissed a genuinely missing file');
console.log(`    verifier confirms missing files ✓`);

// 10 · no empty files — fallback templates + resilient preview
const { fallbackFile } = await import('../src/lib/projects.js');
const fbHtml = fallbackFile('index.html', [{ path: 'css/style.css' }, { path: 'js/app.js' }], 'Test App');
if (!/<\/html>/i.test(fbHtml) || !/css\/style\.css/.test(fbHtml) || !/js\/app\.js/.test(fbHtml)) throw new Error('html template must link the planned css/js');
const fbJs = fallbackFile('js/app.js', [], 'Test App');
if (!/addEventListener/.test(fbJs) || !/console\.log/.test(fbJs)) throw new Error('js template must be runnable');
const fbCss = fallbackFile('css/style.css', [], 'Test App');
if (!/body\s*\{/.test(fbCss)) throw new Error('css template must style the page');
const pv10 = assemblePreview([
  { path: 'css/style.css', content: 'body { background: #000; }' },
  { path: 'js/app.js', content: "console.log('hi');" },
]);
if (!/<\/html>/i.test(pv10)) throw new Error('preview did not synthesize an html shell');
if (!/<style>[\s\S]*background: #000/.test(pv10)) throw new Error('synthesized preview did not inline the css');
if (!/console\.log\('hi'\)/.test(pv10)) throw new Error('synthesized preview did not inline the js');
console.log(`[10] no-empty-files — templates ok · synthesized preview inlines css+js ✓`);

// simulate a broken model: empty output on the first try, real code on retry
const { finalizeEntry } = await import('../src/lib/projects.js');
let calls11 = 0;
const entry11 = { path: 'js/app.js', content: '', status: 'writing', bytes: 0 };
const out11 = await finalizeEntry({
  ask: () => {},
  entry: entry11,
  buildAsk: async () => (++calls11 === 1 ? '' : 'const app = 1;\nconsole.log(app); // real code\n'.repeat(3)),
  retryNote: () => {},
  fallbackNote: () => {},
  say: () => {},
  planFiles: [],
  title: 'T',
});
if (out11 !== 'done' || calls11 !== 2) throw new Error('empty output was not retried');
if (!/real code/.test(entry11.content)) throw new Error('retry content not kept');

// and a totally dead model: template fallback, never an empty file
let calls12 = 0;
const entry12 = { path: 'index.html', content: '', status: 'writing', bytes: 0 };
const out12 = await finalizeEntry({
  ask: () => {},
  entry: entry12,
  buildAsk: async () => { calls12++; return ''; },
  retryNote: () => {},
  fallbackNote: () => {},
  say: () => {},
  planFiles: [{ path: 'css/style.css' }, { path: 'js/app.js' }],
  title: 'Dead Model App',
});
if (out12 !== 'template' || calls12 !== 2) throw new Error('dead model did not fall back after retry');
if (!entry12.content.trim() || !/<\/html>/i.test(entry12.content)) throw new Error('fallback template missing/broken');
if (entry12.status !== 'template' || entry12.fallback !== true) throw new Error('template flags missing');
console.log(`    empty→retry recovers ✓ · dead→template fallback ✓ (never empty)`);

// 11 · SSR render sweep — every view in every state. A render crash is a
//     black screen for the user; this catches them all (incl. mid-run).
globalThis.matchMedia ??= (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.window ??= globalThis;
const React11 = (await import('react')).default;
const { renderToString } = await import('react-dom/server');
const { default: App } = await import('../src/App.jsx');
const { actions: A11, useStore: useStore11 } = await import('../src/store.js');
const { PROVIDERS: P11 } = await import('../shared/providers.js');

const errors11 = [];
const sweep11 = (label) => {
  try {
    const html = renderToString(React11.createElement(App));
    if (!html || html.length < 50) errors11.push(`${label}: empty render`);
    else console.log(`    ✓ ${label} · ${html.length} chars`);
  } catch (e) {
    errors11.push(`${label}: ${e && e.message}`);
    console.log(`    ✗ ${label}: ${e && e.message}`);
  }
};

// force the offline demo everywhere so the sweep is deterministic
A11.setSettings({ web: false });
A11.setSolo({ provider: 'demo', model: 'nexus-demo' });
A11.setSquad({
  workers: [{ provider: 'demo', model: 'nexus-demo' }],
  planner: { provider: 'demo', model: 'nexus-demo' },
  critic: { provider: 'demo', model: 'nexus-demo' },
  synth: { provider: 'demo', model: 'nexus-demo' },
});
A11.setPrjModel({ provider: 'demo', model: 'nexus-demo' });

// start screen (wizard)
A11.setView('projects');
A11.openProjectWizard();
sweep11('projects · start screen');

// mid-run project — the exact state that used to black-screen
const run11 = A11.startProject('a neon pomodoro timer app');
await new Promise((r) => setTimeout(r, 500));
sweep11('projects · mid-run (planning)');
await new Promise((r) => setTimeout(r, 2500));
sweep11('projects · mid-run (building)');
await run11;
sweep11('projects · finished');

// chat: team message mid-stream + finished (WorkLog phases + sources)
A11.setView('chat');
A11.newConversation();
A11.sendMessage('tell me about the pomodoro technique'); // fire-and-forget
await new Promise((r) => setTimeout(r, 1500));
sweep11('chat · team mid-stream');
// sendMessage is fire-and-forget — poll the store until the run completes
const Probe11 = () => {
  const st = useStore11();
  return st.streaming || st.projectBusy ? 'BUSY' : 'DONE';
};
let done11 = false;
for (let i = 0; i < 180; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (renderToString(React11.createElement(Probe11)) === 'DONE') { done11 = true; break; }
}
if (!done11) throw new Error('chat generation did not finish in 90s');
sweep11('chat · team finished');
{
  const html = renderToString(React11.createElement(App));
  if (!html.includes('foldrow')) throw new Error('finished team message missing the folded badges');
  if (!/pomodoro/i.test(html)) throw new Error('final answer content missing');
}

// mid-upgrade — the up-* code paths (planner/builders/re-test)
A11.setView('projects');
const up11 = A11.upgradeProject('add sound effects');
await new Promise((r) => setTimeout(r, 1500));
sweep11('projects · mid-upgrade');
await up11;
sweep11('projects · upgraded (v2)');

// every remaining view
for (const v of ['agents', 'keys']) {
  A11.setView(v);
  sweep11(`${v} view`);
}

if (errors11.length) throw new Error('SSR render crashes: ' + errors11.join(' | '));
console.log(`[11] SSR render sweep — 11 states, zero crashes ✓`);

// 12 · LIVE FETCHING — the Researcher opens and reads real pages
const { readUrl, searchWeb: searchWeb12 } = await import('../src/lib/websearch.js');
// route 1: the Jina reader (browser-direct, keyless)
const jinaFetch = async (url) => {
  if (url.startsWith('https://r.jina.ai/'))
    return { ok: true, text: async () => '# Pomodoro Technique\n\n' + 'The method uses a timer to break work into intervals. '.repeat(30) };
  throw new Error('unexpected ' + url);
};
const r12a = await readUrl('https://en.wikipedia.org/wiki/Pomodoro_Technique', { fetchImpl: jinaFetch });
if (!r12a || r12a.via !== 'jina' || !/Pomodoro Technique/.test(r12a.text)) throw new Error('jina read route failed');
// route 2: the self-hosted server fetcher fallback
const srvFetch = async (url) => {
  if (url.includes('r.jina.ai')) return { ok: false };
  if (url.includes('/api/fetch')) return { ok: true, json: async () => ({ text: 'Plain server-fetched page content about timers. '.repeat(10) }) };
  throw new Error('unexpected ' + url);
};
const r12b = await readUrl('https://example.com/page', { fetchImpl: srvFetch });
if (!r12b || r12b.via !== 'server' || !/server-fetched/.test(r12b.text)) throw new Error('server fallback route failed');
// deep search: full pages merged into the knowledge block
const deepFetch = async (url) => {
  if (url.includes('r.jina.ai/')) return { ok: true, text: async () => 'FULL PAGE: the pomodoro technique uses a kitchen timer. '.repeat(20) };
  if (url.includes('api.github.com'))
    return { ok: true, json: async () => ({ items: [{ full_name: 'nexus/demo', stargazers_count: 42, description: 'demo app', html_url: 'https://github.com/nexus/demo' }] }) };
  if (url.includes('duckduckgo.com'))
    return { ok: true, json: async () => ({ Heading: 'Pomodoro', AbstractText: 'Time management method.', AbstractURL: 'https://ddg.example/pomodoro' }) };
  if (url.includes('list=search')) return { ok: true, json: async () => ({ query: { search: [{ title: 'Pomodoro Technique' }] } }) };
  return { ok: true, json: async () => ({ query: { pages: { '1': { title: 'Pomodoro Technique', extract: 'Timer-based work intervals.' } } } }) };
};
const w12 = await searchWeb12('pomodoro timer app', { fetchImpl: deepFetch, deep: true });
console.log(`[12] live fetching — jina ✓ · server fallback ✓ · deep: ${w12.readCount} pages read`);
if (!w12.ok || !w12.readCount || w12.readCount < 3) throw new Error('deep search did not read the top 3 pages');
if (!/FULL PAGE CONTENT/.test(w12.knowledge)) throw new Error('full-page section missing from knowledge');
if (!/researched LIVE on/.test(w12.knowledge)) throw new Error('live fetch date missing from knowledge');
if (!/FULL PAGE: the pomodoro technique/.test(w12.knowledge)) throw new Error('page content missing from knowledge');
if (!w12.sources.some((x) => x.read)) throw new Error('read flag missing on sources');
// the real server endpoint: fetch our own health (JSON) + index (HTML strip)
const BASE12 = globalThis.__NEXUS_PROXY_BASE;
const j12 = await fetch(`${BASE12}/api/fetch?url=${encodeURIComponent(BASE12 + '/api/health')}`).then((r) => r.json());
if (!j12?.text || !/NexusAI/.test(j12.text)) throw new Error('server /api/fetch (json) failed: ' + JSON.stringify(j12).slice(0, 160));
const h12 = await fetch(`${BASE12}/api/fetch?url=${encodeURIComponent(BASE12 + '/')}`).then((r) => r.json());
if (!h12?.text || /<html/i.test(h12.text) || !/NexusAI/i.test(h12.text)) throw new Error('server /api/fetch (html strip) failed');
const bad12 = await fetch(`${BASE12}/api/fetch?url=${encodeURIComponent('javascript:alert(1)')}`);
if (bad12.status !== 400) throw new Error('server accepted a non-http URL (status ' + bad12.status + ')');
console.log(`    server /api/fetch — json passthrough ✓ · html→text strip ✓ · non-http rejected ✓`);

// 13 · design sense — KB styles, MDN coding docs, gallery refs, trend research
const { designPack } = await import('../src/lib/designkb.js');
const { searchWeb: searchWeb13, researchDesign: researchDesign13 } = await import('../src/lib/websearch.js');
const dpA = designPack('a professional portfolio website');
const dpB = designPack('a retro snake game');
if (!dpA?.text || !/PALETTE/.test(dpA.text) || !/#[0-9a-f]{6}/i.test(dpA.text)) throw new Error('design pack missing palette');
if (!/QUALITY BAR/.test(dpA.text)) throw new Error('design pack missing quality bar');
if (dpA.id === dpB.id) throw new Error('style selection is not keyword-aware');
if (dpB.id !== 'retro-terminal') throw new Error('game should pick retro-terminal, got ' + dpB.id);
if (designPack('a random thing machine').id !== 'aurora-glass') throw new Error('default style wrong');

// MDN coding docs flow through searchWeb for techy queries
const mdnFetch = async (url) => {
  if (url.includes('developer.mozilla.org')) return { ok: true, json: async () => ({ documents: [{ title: 'Web Audio API', mdn_url: '/en-US/docs/Web/API/Web_Audio_API', summary: 'Play and synthesize audio in the browser.' }] }) };
  if (url.includes('api.github.com')) return { ok: true, json: async () => ({ items: [] }) };
  if (url.includes('duckduckgo.com')) return { ok: true, json: async () => ({}) };
  if (url.includes('list=search')) return { ok: true, json: async () => ({ query: { search: [] } }) };
  return { ok: true, json: async () => ({ query: { pages: {} } }) };
};
const w13 = await searchWeb13('how to use the webaudio api', { fetchImpl: mdnFetch });
if (!w13.sources.some((x) => x.source === 'mdn')) throw new Error('MDN coding docs missing from sources');
if (!/Coding docs \(MDN Web Docs/.test(w13.knowledge)) throw new Error('MDN section missing from knowledge');

// design research: current-year trends + real gallery references
const designFetch = async (url) => {
  if (url.includes('r.jina.ai/https://darkmodedesign.com'))
    return { ok: true, text: async () => '# Dark Mode Design — dark interface gallery\n\nBrowse the best dark mode web designs. ' + 'Curated dark UI inspiration for designers and developers worldwide. '.repeat(6) + '\n\n[Neon portfolio by AK](https://example.com/ak)\n[Deep space dashboard](https://example.com/ds)\n[About](https://darkmodedesign.com/about)\n' };
  if (url.includes('duckduckgo.com')) return { ok: true, json: async () => ({ Heading: 'Web design trends 2026', AbstractText: 'Glassmorphism, bento grids and aurora gradients dominate 2026.', AbstractURL: 'https://ddg.example/trends' }) };
  if (url.includes('list=search')) return { ok: true, json: async () => ({ query: { search: [{ title: 'Web design trends 2026' }] } }) };
  if (url.includes('r.jina.ai/')) return { ok: true, text: async () => 'FULL PAGE: 2026 trends include glass cards, bento layouts, gradient meshes. '.repeat(8) };
  return { ok: true, json: async () => ({ query: { pages: { '1': { title: 'Web design trends 2026', extract: 'Bento grids, glassmorphism, aurora gradients.' } } } }) };
};
const dr13 = await researchDesign13('portfolio website', { fetchImpl: designFetch });
if (!/DESIGN INTELLIGENCE/.test(dr13.knowledge)) throw new Error('design trend knowledge missing');
if (!dr13.refs.some((r) => /Neon portfolio/.test(r.title))) throw new Error('gallery references missing');
if (dr13.refs.some((r) => /darkmodedesign\.com/.test(r.url))) throw new Error('gallery self-links not filtered');

// the demo Designer itself now ships the 2026 look
const css13 = demoResponse({ messages: [ { role: 'system', content: 'You are the DESIGNER (FILE BUILDER) of the NexusAI project team.' }, { role: 'user', content: 'PROJECT FILE: css/style.css' } ] });
if (!/backdrop-filter|linear-gradient/.test(css13)) throw new Error('demo designer styling not upgraded');
console.log(`[13] design sense — KB styles ✓ · MDN docs ✓ · gallery refs ✓ (${dr13.refs.length}) · trends ✓ · demo 2026 look ✓`);

// 14 · easy keys — smart paste detection, backup round-trip, connect flow UI
const { parseKeys, exportEnv, maskKey } = await import('../src/lib/keydetect.js');
const A14 = A11; // reuse the live store + React from the sweep

// detection: single, .env file (export/quotes/comments/unknown vars), multi bare
const k14a = parseKeys('gsk_abc123def456ghi789jkl012mno');
if (k14a[0]?.provider !== 'groq') throw new Error('bare key not detected');
const k14b = parseKeys(
  '# my keys\n' +
  'export GROQ_API_KEY="gsk_aaaa1111bbbb2222cccc3333dddd4444"\n' +
  'OPENROUTER_API_KEY=sk-or-v1-xyz123longkeyvaluehere99\n' +
  "GEMINI_API_KEY='AIzaSyD-1234567890abcdefghijklmnopqrstu'\n" +
  'SOME_OTHER_VAR=hello\n'
);
if (k14b.length !== 3 || k14b.map((r) => r.provider).join(',') !== 'groq,openrouter,gemini')
  throw new Error('.env parsing wrong: ' + JSON.stringify(k14b.map((r) => r.provider)));
const k14c = parseKeys(
  'sk-ant-api03-aaaa-bbbb-cccc-dddd-eeeeffff1111\n' +
  'hf_xxabcdefgh1234567890abcdefgh12345\n' +
  'nvapi-nexus123nexus123nexus123nexus1\n' +
  'github_pat_11AAAAAAA0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
  'csk-cerebraskey1234567890abcdef\n'
);
if (k14c.map((r) => r.provider).join(',') !== 'anthropic,huggingface,nvidia,github,cerebras')
  throw new Error('multi bare keys wrong: ' + JSON.stringify(k14c.map((r) => r.provider)));
// ambiguity + exotic formats
const k14d = parseKeys('sk-0123456789abcdef0123456789abcdef');
if (k14d[0].provider !== 'deepseek' || k14d[0].guess !== true) throw new Error('sk-32hex should be deepseek (switchable)');
if (parseKeys('abcdef0123456789abcdef0123456789.0123456789abcdef0123456789abcdef')[0].provider !== 'zai') throw new Error('zai id.secret not detected');
if (parseKeys('thisIsNotAnyKnownKeyFormat12345')[0].provider !== null) throw new Error('unknown key should offer picker');
// dedupe: last value wins per provider
const k14e = parseKeys('gsk_firstkeyaaaaaaaaaaaaaaaaaaaaa\ngsk_secondkeybbbbbbbbbbbbbbbbbbbbbbb');
if (k14e.length !== 1 || !/second/.test(k14e[0].key)) throw new Error('dedupe failed');

// backup round-trip: exportEnv → parseKeys recovers the same keys
const env14 = exportEnv({ groq: 'gsk_roundtrip_test_1234567890abcd', openrouter: 'sk-or-v1-roundtrip-test-1234567890' });
const back14 = parseKeys(env14);
if (back14.length !== 2 || back14[0].key !== 'gsk_roundtrip_test_1234567890abcd' || back14[1].key !== 'sk-or-v1-roundtrip-test-1234567890')
  throw new Error('backup round-trip failed: ' + JSON.stringify(back14));

// UI flow: zero keys → first-run guide; connect via SmartPaste path → guide gone, check-all appears
A14.setView('keys');
A14.removeKey('groq'); A14.removeKey('openrouter');
let html14 = renderToString(React11.createElement(App));
if (!html14.includes('Quick Connect')) throw new Error('Quick Connect panel missing');
if (!html14.includes('Get your first key')) throw new Error('first-run guide missing with zero keys');
if (!html14.includes('60 seconds')) throw new Error('quick start cards missing');
// simulate the exact SmartPaste connect: parse → patch → setKeys
const rows14 = parseKeys('GROQ_API_KEY=gsk_uiflow_test_1234567890abcd\nOPENROUTER_API_KEY=sk-or-v1-uiflow-test-1234567890');
const patch14 = {};
for (const r of rows14) patch14[r.provider] = r.key;
A14.setKeys(patch14);
html14 = renderToString(React11.createElement(App));
if (html14.includes('Get your first key')) throw new Error('first-run guide should hide once keys exist');
if (!html14.includes('Check all 2')) throw new Error('check-all button missing after connecting keys');
if (!/Key saved/.test(html14)) throw new Error('provider status does not show Key saved');
if (!/Connected 3|Connected \d/.test(html14)) throw new Error('connected filter count missing');
// masked display never leaks the full key into the page
if (html14.includes('gsk_uiflow_test_1234567890abcd')) throw new Error('full key leaked into render');
if (maskKey('gsk_uiflow_test_1234567890abcd') === 'gsk_uiflow_test_1234567890abcd') throw new Error('maskKey not masking');
A14.removeKey('groq'); A14.removeKey('openrouter'); // leave clean state
console.log(`[14] easy keys — detect ✓ (.env/multi/ambiguous/exotic) · backup round-trip ✓ · connect flow UI ✓ (guide→hidden, check-all) · no key leak ✓`);

// 15 · Open Air interface — input-first composer, slim control strip, mobile density
{
  A11.setView('chat');
  A11.newConversation();
  const html15 = renderToString(React11.createElement(App));
  // input FIRST, controls below — the textarea must appear before the mode switch
  const taAt = html15.indexOf('<textarea');
  const soloAt = html15.indexOf('intent-chip');
  if (taAt < 0 || soloAt < 0) throw new Error('composer pieces missing from render');
  if (taAt > soloAt) throw new Error('composer is not input-first anymore');
  // v1.18 · the strip is ONE intent chip + the auto-routing hint — no mode wall
  for (const piece of ['composer-bar', 'intent-chip', '🧭', 'auto-routing on']) {
    if (!html15.includes(piece)) throw new Error(`composer strip missing: ${piece}`);
  }
  const strip15 = html15.slice(Math.max(0, html15.indexOf('composer-wrap')));
  for (const gone of ['mode-switch', '>Solo<', '>Team<', '>Image<', '🌐 Web', 'composer-tools', 'aspect-btn']) {
    if (strip15.includes(gone)) throw new Error(`crowded control still visible: ${gone}`);
  }
  A11.setSettings({ mode: 'team' });

  // CSS: mobile rules that make the density real
  const css15 = (await import('node:fs')).readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const mobile15 = css15.slice(css15.indexOf('@media (max-width: 760px)'));
  if (!/\.composer-bar[^}]*overflow-x:\s*auto/.test(mobile15)) throw new Error('control strip not scrollable on mobile');
  if (!/\.composer-note\s*{\s*display:\s*none/.test(mobile15)) throw new Error('composer note not hidden on mobile');
  if (!/\.msg-sources\s*{[^}]*flex-wrap:\s*nowrap/.test(mobile15)) throw new Error('sources not a single strip on mobile');
  if (!/\.icon-btn\s*{[^}]*38px/.test(mobile15)) throw new Error('tap targets not sized on mobile');
  if (!/scrollbar-width:\s*thin/.test(css15)) throw new Error('slim scrollbars missing');
  if (!/\.composer-bar\s*{[^}]*padding:\s*0 10px 10px/.test(css15)) throw new Error('desktop bar padding wrong');
}
console.log(`[15] open air — input-first composer ✓ · one intent chip, zero mode wall ✓ · sources strip ✓ · mobile density rules ✓`);

// 16 · OpenRouter top models — bigger curated catalog + live free-tier merge
{
  const { getProvider: gp16 } = await import('../shared/providers.js');
  const { fetchLiveOpenRouter } = await import('../src/store.js');
  const or16 = gp16('openrouter');
  if (or16.models.length < 28) throw new Error('curated OpenRouter list too small: ' + or16.models.length);
  const ids16 = or16.models.map((m) => m.id);
  if (new Set(ids16).size !== ids16.length) throw new Error('duplicate OpenRouter model ids');
  for (const m of or16.models) {
    if (m.id.endsWith(':free') && !m.tags.includes('FREE')) throw new Error(':free model not tagged FREE — ' + m.id);
    if (!m.label) throw new Error('model missing label — ' + m.id);
  }
  for (const must of ['openai/gpt-5.1', 'anthropic/claude-opus-4.5', 'google/gemini-3-pro-preview', 'moonshotai/kimi-k2:free', 'x-ai/grok-4.1', 'minimax/minimax-m2', 'deepseek/deepseek-r1-0528:free', 'z-ai/glm-4.6', 'openai/gpt-oss-20b:free']) {
    if (!ids16.includes(must)) throw new Error('top model missing from catalog: ' + must);
  }

  // live catalog merge — keyless /api/v1/models shape, mocked
  const realFetch16 = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 0324 (free)', pricing: { prompt: '0', completion: '0' } }, // curated → no dupe
        { id: 'acme/brand-new-free', name: 'Acme Brand New (free)', pricing: { prompt: '0', completion: '0' } },                  // fresh free → LIVE extra
        { id: 'acme/paid-flagship', name: 'Acme Paid Flagship', pricing: { prompt: '0.002', completion: '0.004' } },             // paid extra → excluded
        { id: 'acme/free-embeddings', name: 'Acme Embeddings', pricing: { prompt: '0', completion: '0' } },                      // non-chat → excluded
      ],
    }),
  });
  await fetchLiveOpenRouter();
  globalThis.fetch = realFetch16;
  const merged16 = renderToString(React11.createElement(() => (useStore11().liveModels.openrouter || []).map((m) => [m.id, m.label, (m.tags || []).join('.')].join('~')).join('|')))
    .split('|')
    .filter(Boolean)
    .map((row) => {
      const [id, label, tags] = row.split('~');
      return { id, label, tags: tags ? tags.split('.') : [] };
    });
  if (merged16.length !== or16.models.length + 1) throw new Error('merge size wrong: ' + merged16.length);
  const fresh16 = merged16.find((m) => m.id === 'acme/brand-new-free');
  if (!fresh16) throw new Error('fresh free model not merged');
  if (fresh16.label !== 'Acme Brand New' || !fresh16.tags.includes('LIVE') || !fresh16.tags.includes('FREE')) throw new Error('live extra wrong: ' + JSON.stringify(fresh16));
  if (merged16.some((m) => m.id === 'acme/paid-flagship' || m.id === 'acme/free-embeddings')) throw new Error('paid/embed leaked into merged list');
  if (merged16.filter((m) => m.id === 'deepseek/deepseek-chat-v3-0324:free').length !== 1) throw new Error('curated model duplicated by live fetch');
  console.log(`[16] openrouter models — curated ${or16.models.length} (${or16.models.filter((m) => m.tags.includes('FREE')).length} free) ✓ · live merge: +LIVE free only, no dupes/paid/embed ✓ · labels cleaned ✓`);
}

// 17 · Image Team — 5-stage pipeline + quiet worklog UI
{
  const { runImagePipeline } = await import('../src/lib/imagepipe.js');
  const checks17 = [];
  const stagesSeen17 = [];
  const out17 = await runImagePipeline({
    prompt: 'a dragon over a city',
    count: 2, aspect: '1:1', aspectW: 1024, aspectH: 1024, web: true,
    search: async () => 'dragons: scaled wings, ember glow',
    complete: async () => 'a colossal ember dragon circling a neon city at dusk, volumetric light, 85mm lens, ultra detailed',
    generate: async ({ i, retry }) => ({ src: 'blob:x' + i + (retry ? 'r' : ''), w: 1024, h: 1024, seed: i + (retry ? 10 : 0), model: 'flux', provider: 'pollinations', prompt: 'p', remote: false }),
    upscale: async (im) => ({ ...im, src: 'blob:sharp' + im.seed, upscaled: true }),
    check: async (im) => { checks17.push(im.seed); return im.seed === 0 ? { pass: false, why: 'blank frame' } : { pass: true }; },
    onStage: (st, status) => stagesSeen17.push(st + ':' + status),
  });
  if (out17.images.length !== 2 || !out17.images.every((i) => i.check === 'pass')) throw new Error('images bad');
  if (JSON.stringify(checks17) !== '[0,10,1]') throw new Error('retry flow wrong: ' + JSON.stringify(checks17));
  if (out17.enhancedBy !== 'model' || !/dragon/i.test(out17.enhancedPrompt)) throw new Error('enhancer bad');
  const seq17 = out17.stages.map((x) => x.stage);
  if (seq17.indexOf('research') > seq17.indexOf('enhance') || seq17.indexOf('enhance') > seq17.indexOf('generate')) throw new Error('stage order wrong');
  if (!stagesSeen17.includes('check:retry')) throw new Error('retry stage not reported');

  // deterministic fallback + all-fail warn
  const out17b = await runImagePipeline({ prompt: 'a cat', count: 1, web: false, complete: async () => { throw new Error('down'); }, generate: async () => ({ src: 'blob:c', w: 1024, h: 1024, remote: false }), upscale: async (im) => ({ ...im, upscaled: false }), check: async () => ({ pass: true }) });
  if (out17b.enhancedBy !== 'deterministic' || !/cat/.test(out17b.enhancedPrompt)) throw new Error('fallback enhancer failed');
  const out17c = await runImagePipeline({ prompt: 'x', count: 1, web: false, complete: async () => 'short', generate: async () => { throw new Error('provider down'); }, check: async () => ({ pass: true }) });
  if (out17c.images.length !== 0 || out17c.warns.length !== 1) throw new Error('all-fail path wrong');

  // UI: render an image message mid-run + finished with the worklog pattern
  const Message17 = (await import('../src/components/Message.jsx')).default;
  const msgRun17 = { id: 'm17', role: 'assistant', kind: 'image', mode: 'image', streaming: true, images: [], istages: [
    { stage: 'research', status: 'done' }, { stage: 'enhance', status: 'done' }, { stage: 'generate', status: 'run', detail: 'image 1/1' },
  ] };
  const htmlRun17 = renderToString(React11.createElement(Message17, { msg: msgRun17, isLast: true }));
  if (!/NEXUSAI is (drawing|thinking|searching)/i.test(htmlRun17)) throw new Error('main loader phase text missing mid-run');
  if (!htmlRun17.includes('nx-hex')) throw new Error('pulsing hexagon loader missing mid-run');
  if (!/image 1\/1/.test(htmlRun17)) throw new Error('live stage detail missing');
  const msgDone17 = { id: 'm17d', role: 'assistant', kind: 'image', mode: 'image', streaming: false, ms: 24000, images: [
    { src: 'blob:z', w: 1024, h: 1024, model: 'flux', check: 'pass', upscaled: true },
  ], istages: [
    { stage: 'research', status: 'done' }, { stage: 'enhance', status: 'done' }, { stage: 'generate', status: 'done' },
    { stage: 'upscale', status: 'done' }, { stage: 'check', status: 'done' },
  ], enhancedPrompt: 'a colossal ember dragon, volumetric light, 85mm, ultra detailed' };
  const htmlDone17 = renderToString(React11.createElement(Message17, { msg: msgDone17, isLast: false }));
  for (const piece of ['Searched', 'Enhanced', 'Drew 1 image', 'Sharpened', 'Previewed — 1/1 PASS', 'sharpened', 'ember dragon']) {
    if (!htmlDone17.includes(piece)) throw new Error('finished image message missing: ' + piece);
  }
  console.log(`[17] image team — research→enhance→generate→upscale→check ✓ · retry-on-fail ✓ (${checks17.join(',')}) · deterministic fallback ✓ · all-fail warns ✓ · worklog UI ✓`);
}

// 18 · images are always visible — durability + recovery chain
{
  const { recoverChain, regenFor, pollinationsUrl } = await import('../src/lib/images.js');
  const { runImagePipeline: pipe18 } = await import('../src/lib/imagepipe.js');
  const { storage: store18 } = await import('../src/lib/storage.js');

  // recovery chain order: src → data → regen url (deduped)
  const im18 = {
    src: 'blob:alive', data: 'data:image/jpeg;base64,AAA',
    regen: { url: 'https://image.pollinations.ai/prompt/x?seed=1' },
  };
  const chain18 = recoverChain(im18);
  if (JSON.stringify(chain18) !== JSON.stringify(['blob:alive', 'data:image/jpeg;base64,AAA', 'https://image.pollinations.ai/prompt/x?seed=1']))
    throw new Error('chain order wrong: ' + JSON.stringify(chain18));
  if (recoverChain({ src: 'blob:x', data: 'data:image/jpeg;base64,AAA' }).length !== 2) throw new Error('chain without regen wrong');
  if (recoverChain({}).length !== 0) throw new Error('empty chain not empty');

  // regen recipe: pollinations deterministic URL; openai recipe without URL
  const r18 = regenFor({ provider: 'pollinations', model: 'flux', prompt: 'a dragon', w: 1024, h: 1024, seed: 42 }, 'enhanced dragon');
  if (r18.prompt !== 'enhanced dragon' || r18.url !== pollinationsUrl({ prompt: 'enhanced dragon', model: 'flux', w: 1024, h: 1024, seed: 42 }))
    throw new Error('pollinations regen recipe wrong');
  const r18b = regenFor({ provider: 'openai-images', model: 'dall-e-3', prompt: 'p', w: 1024, h: 1024, seed: 7 }, 'p');
  if (r18b.provider !== 'openai-images' || r18b.url) throw new Error('openai regen should have no url (data covers it)');

  // pipeline attaches regen to every shipped image
  const out18 = await pipe18({
    prompt: 'a dragon', count: 1, web: false,
    complete: async () => 'ignored',
    generate: async () => ({ src: 'blob:zz', w: 1024, h: 1024, seed: 5, model: 'flux', provider: 'pollinations', prompt: 'a dragon', remote: false }),
    upscale: async (im) => ({ ...im, upscaled: true }),
    check: async () => ({ pass: true }),
  });
  if (!out18.images[0]?.regen?.url) throw new Error('pipeline image missing regen recipe');
  if (out18.images[0].check !== 'pass') throw new Error('pipeline check badge missing');

  // storage: progressive strip keeps images recoverable (oldest data dropped first, regen kept)
  const mkImg = (i) => ({ src: 'blob:s' + i, data: 'data:image/jpeg;base64,' + 'A'.repeat(60_000), regen: { url: 'https://image.pollinations.ai/prompt/i' + i }, model: 'flux', w: 1024, h: 1024, seed: i });
  const convs18 = [
    { id: 'c1', title: 'old', messages: [
      { id: 'm1', kind: 'image', role: 'assistant', images: [mkImg(1)] },
      { id: 'm2', kind: 'image', role: 'assistant', images: [mkImg(2)] },
      { id: 'm3', kind: 'image', role: 'assistant', images: [mkImg(3)] },
      { id: 'm4', kind: 'text', role: 'assistant', content: 'X'.repeat(3_900_000) },
    ]},
  ];
  const LS18 = new Map();
  globalThis.localStorage = { getItem: (k) => LS18.get(k) ?? null, setItem: (k, v) => LS18.set(k, String(v)), removeItem: (k) => LS18.delete(k) };
  store18.saveConvs(convs18);
  const saved18 = JSON.parse(LS18.get('nexus.convs.v1'))[0];
  const imgs18 = saved18.messages.filter((m) => m.kind === 'image').flatMap((m) => m.images);
  if (imgs18.length !== 3) throw new Error('images lost entirely');
  if (!imgs18.every((im) => im.regen?.url)) throw new Error('regen recipes stripped — images unrecoverable');
  if (imgs18.every((im) => im.data)) throw new Error('strip never ran despite over-budget payload');
  const keptData18 = imgs18.filter((im) => im.data).length;
  if (keptData18 === 0 || keptData18 === 3) throw new Error('expected partial data retention, got ' + keptData18);
  if (LS18.get('nexus.convs.v1').length > 4_050_000) throw new Error('payload still over budget after strip: ' + LS18.get('nexus.convs.v1').length);
  delete globalThis.localStorage;

  // UI: dead blob + data → img renders from src with onError armed; no candidates → friendly card
  const Message18 = (await import('../src/components/Message.jsx')).default;
  const msgA18 = { id: 'a18', role: 'assistant', kind: 'image', mode: 'image', streaming: false, images: [im18] };
  const htmlA18 = renderToString(React11.createElement(Message18, { msg: msgA18, isLast: false }));
  if (!htmlA18.includes('blob:alive')) throw new Error('img not rendering from live src');
  const msgB18 = { id: 'b18', role: 'assistant', kind: 'image', mode: 'image', streaming: false, images: [{ model: 'flux', w: 1024, h: 1024 }] };
  const htmlB18 = renderToString(React11.createElement(Message18, { msg: msgB18, isLast: false }));
  if (!/Image unavailable/.test(htmlB18)) throw new Error('last-resort card missing for unrecoverable image');
  console.log(`[18] image durability — chain src→data→regen ✓ · recipes on every image ✓ · progressive strip (kept ${keptData18}/3 data, all regen) ✓ · UI recovery + last-resort card ✓`);
}

// 19 · auto-best + forced calls + image memory
{
  const { autoConfigure } = await import('../src/lib/autobest.js');
  const { forcedStreamChat } = await import('../src/lib/ai.js');
  const { runImagePipeline: pipe19 } = await import('../src/lib/imagepipe.js');

  // ── auto-best: ranking + upgrade rules
  const st19 = { keys: { groq: 'gsk_x', github: 'ghp_x' }, envKeys: [], solo: { provider: 'pollinations', model: 'openai' },
    squad: { workers: [{ provider: 'pollinations', model: 'qwen-coder' }], planner: { provider: 'pollinations', model: 'mistral' }, critic: { provider: 'pollinations', model: 'mistral' }, synth: { provider: 'pollinations', model: 'openai' } },
    prj: { provider: 'pollinations', model: 'qwen-coder' }, image: { provider: 'pollinations', model: 'flux' } };
  const cfg19 = autoConfigure(st19);
  if (cfg19.solo.provider !== 'groq' || cfg19.solo.model !== 'llama-3.3-70b-versatile') throw new Error('solo not upgraded to best chat: ' + JSON.stringify(cfg19.solo));
  if (cfg19.squad.workers[0].provider !== 'groq' || cfg19.squad.workers[0].model !== 'openai/gpt-oss-120b') throw new Error('coder not upgraded: ' + JSON.stringify(cfg19.squad.workers[0]));
  if (cfg19.prj.provider !== 'groq') throw new Error('project model not upgraded');
  if (!cfg19.changes.length) throw new Error('changes list empty');
  // deliberate working pick is never touched
  const st19b = { ...st19, solo: { provider: 'github', model: 'openai/gpt-4o-mini' } };
  if (JSON.stringify(autoConfigure(st19b).solo) !== JSON.stringify(st19b.solo)) throw new Error('deliberate pick was clobbered');
  // dead slot (key removed) remaps
  const st19c = { keys: {}, envKeys: [], solo: { provider: 'groq', model: 'llama-3.3-70b-versatile' }, squad: { workers: [], planner: {}, critic: {}, synth: {} }, prj: {}, image: {} };
  const cfg19c = autoConfigure(st19c);
  if (cfg19c.solo.provider !== 'pollinations') throw new Error('dead solo not remapped to free default');
  // image: openai key → DALL·E, no key → free flux
  const st19d = { keys: { openai: 'sk-x' }, envKeys: [], solo: {}, squad: { workers: [], planner: {}, critic: {}, synth: {} }, prj: {}, image: { provider: 'pollinations', model: 'flux' } };
  const img19 = autoConfigure(st19d).image;
  if (img19.provider !== 'openai-images' || img19.model !== 'dall-e-3') throw new Error('image not upgraded to DALL·E: ' + JSON.stringify(img19));
  const img19b = autoConfigure({ ...st19d, keys: {}, image: img19 }).image;
  if (img19b.provider !== 'nexus-engine' || img19b.model !== 'black-forest-labs/flux.2-pro') throw new Error('image not remapped to engine after key loss: ' + JSON.stringify(img19b));

  // ── forced chat cascade: primary dies → next candidate answers, credited
  const attempts19 = [];
  const r19 = await forcedStreamChat(
    [{ provider: 'dead-one', model: 'm1' }, { provider: 'alive', model: 'm2' }, { provider: 'alive', model: 'm3' }],
    { messages: [], onDelta: () => {} },
    async (o) => {
      attempts19.push(o.provider);
      if (o.provider === 'dead-one') throw new Error('network dead');
      return { text: 'answer from ' + o.provider };
    }
  );
  if (r19.provider !== 'alive' || r19.text !== 'answer from alive' || r19.fallbackFrom !== 'dead-one') throw new Error('forced cascade wrong: ' + JSON.stringify(r19));
  if (JSON.stringify(attempts19) !== JSON.stringify(['dead-one', 'alive'])) throw new Error('cascade tried wrong candidates');
  // partial stream is kept, never restarted
  const r19b = await forcedStreamChat([{ provider: 'flaky', model: 'm' }], { onDelta: () => {} }, async (o) => { o.onDelta('partial '); throw new Error('dropped mid-stream'); });
  if (r19b.text !== 'partial ' || !r19b.partial) throw new Error('partial text was discarded');
  // every candidate dead → throws
  let threw19 = false;
  try { await forcedStreamChat([{ provider: 'a', model: 'x' }, { provider: 'b', model: 'y' }], {}, async () => { throw new Error('down'); }); } catch { threw19 = true; }
  if (!threw19) throw new Error('all-dead cascade should throw');

  // ── image memory: enhancer receives earlier images
  let enhInput19 = '';
  await pipe19({
    prompt: 'another one, but red', count: 1, web: false,
    memory: [{ prompt: 'a blue dragon over a city', enhanced: 'a colossal azure dragon, volumetric light' }],
    complete: async ({ user }) => { enhInput19 = user; return 'the same colossal dragon, now crimson'; },
    generate: async () => ({ src: 'blob:m', w: 1024, h: 1024, model: 'flux', provider: 'pollinations', prompt: 'p', remote: false }),
    upscale: async (im) => ({ ...im, upscaled: false }),
    check: async () => ({ pass: true }),
  });
  if (!/Earlier images in this conversation/.test(enhInput19) || !/blue dragon/.test(enhInput19)) throw new Error('image memory not fed to enhancer');

  // ── forced image cascade: primary dies → pollinations forced → succeeds
  const genCalls19 = [];
  const stages19 = [];
  const out19 = await pipe19({
    prompt: 'a castle', count: 1, web: false, provider: 'openai-images', model: 'dall-e-3',
    fallbacks: [{ provider: 'pollinations', model: 'flux' }],
    complete: async () => 'a mighty castle on a cliff, golden hour',
    generate: async (o) => { genCalls19.push(o.provider + '/' + o.model); if (o.provider === 'openai-images') throw new Error('quota exceeded'); return { src: 'blob:fb', w: 1024, h: 1024, model: o.model, provider: o.provider, prompt: 'p', remote: false }; },
    upscale: async (im) => ({ ...im, upscaled: false }),
    check: async () => ({ pass: true }),
    onStage: (st, status, detail) => stages19.push(status === 'fail' ? detail : ''),
  });
  if (out19.images.length !== 1 || out19.images[0].provider !== 'pollinations') throw new Error('forced image fallback failed');
  if (JSON.stringify(genCalls19) !== JSON.stringify(['openai-images/dall-e-3', 'pollinations/flux'])) throw new Error('image cascade wrong: ' + JSON.stringify(genCalls19));
  if (!stages19.some((x) => /forcing next/.test(x))) throw new Error('forcing stage not reported');

  // ── live store: setKeys actually triggers auto-configuration
  A11.setKeys({ groq: 'gsk_live_test_1234567890abcd' });
  const probe19 = renderToString(React11.createElement(() => JSON.stringify([useStore11().solo.provider, useStore11().solo.model]).replace(/"/g, '')));
  if (!probe19.includes('groq')) throw new Error('setKeys did not auto-configure solo — got ' + probe19);
  A11.removeKey('groq');
  console.log(`[19] auto-best + forced calls — ranking/upgrades ✓ · deliberate picks kept ✓ · dead remap ✓ · image best (DALL·E⇄Flux) ✓ · chat cascade credited ✓ · partial kept ✓ · image memory ✓ · forced image fallback ✓ · setKeys auto-configures ✓`);
}

// 20 · auto-intent — the message decides where it goes
{
  const { detectIntent } = await import('../src/lib/intent.js');
  // the four user examples, verbatim
  if (detectIntent('Make a Car with neon light image').mode !== 'image') throw new Error('example 1 wrong');
  if (detectIntent('Search about cars with neon lights').mode !== 'search') throw new Error('example 2 wrong');
  if (detectIntent('Hello how are you').mode !== 'chat') throw new Error('example 3 wrong');
  if (detectIntent('Make a Tesla store project').mode !== 'project') throw new Error('example 4 wrong');
  // matrix
  const matrix20 = [
    ['draw a dragon', 'image'], ['generate a picture of a sunset', 'image'], ['a logo for my startup', 'image'],
    ['build me a snake game', 'project'], ['build me a website for my bakery', 'project'], ['create a dashboard app', 'project'],
    ['what is the capital of france', 'search'], ['look up the latest ai news', 'search'], ['research quantum computing', 'search'],
    ['write a python script that renames files', 'chat'], ['explain how transformers work', 'chat'], ['', 'chat'],
  ];
  for (const [t, want] of matrix20) {
    if (detectIntent(t).mode !== want) throw new Error(`intent wrong for ${JSON.stringify(t)} → ${detectIntent(t).mode}, want ${want}`);
  }
  if (!detectIntent('Hello how are you').smalltalk) throw new Error('smalltalk not detected');
  if (detectIntent('hey make me a game').smalltalk) throw new Error('smalltalk false positive');
  if (detectIntent('hey make me a game').mode !== 'project') throw new Error('greeting prefix broke project detection');

  // store routing: project text leaves chat and starts a project run
  A11.setView('chat');
  A11.newConversation();
  A11.setSettings({ mode: 'team', autoIntent: true });
  A11.sendMessage('make a neon arcade game project');
  let routed20 = false;
  for (let i = 0; i < 30 && !routed20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    routed20 = renderToString(React11.createElement(() => String(useStore11().view))) === 'projects';
  }
  if (!routed20) throw new Error('project-intent message did not route to Projects view');
  // wait for that run to finish so later tests see a clean state
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (renderToString(React11.createElement(() => (useStore11().streaming || useStore11().projectBusy ? 'BUSY' : 'DONE'))) === 'DONE') break;
  }
  // manual override wins: autoIntent off keeps the picked mode
  A11.setSettings({ autoIntent: false, mode: 'solo' });
  A11.setView('chat');
  const html20 = renderToString(React11.createElement(App));
  if (html20.includes('auto-routing on')) throw new Error('auto hint should be gone in manual mode');
  if (!html20.includes('Enter ↵ send')) throw new Error('manual override not active');
  A11.setSettings({ autoIntent: true, mode: 'team' });
  console.log('[20] auto-intent — 4/4 examples ✓ · 12-case matrix ✓ · smalltalk lane ✓ · project routing live ✓ · manual override ✓');
}

// 21 · the visible chip is the model picker
{
  const { modelLabel: ml21 } = await import('../shared/providers.js');
  const src21 = (await import('node:fs')).readFileSync(new URL('../src/components/Composer.jsx', import.meta.url), 'utf8');
  if (!src21.includes('ModelOptions')) throw new Error('chip menu does not embed the real model list');
  if (!/intent-model/.test(src21)) throw new Error('chip does not show a model name');
  // manual solo: chip names the exact solo model
  A11.setSettings({ autoIntent: false, mode: 'solo' });
  let st21 = null;
  renderToString(React11.createElement(() => { st21 = useStore11(); return ''; }));
  const want21 = modelLabelSafeguard(st21.solo.provider, st21.solo.model);
  const html21 = renderToString(React11.createElement(App));
  if (!html21.includes('intent-model')) throw new Error('chip model name missing');
  if (want21 && !html21.includes(want21.slice(0, 10))) throw new Error(`chip does not name the solo model (${want21})`);
  // manual image: chip names the image model
  A11.setSettings({ mode: 'image' });
  const html21b = renderToString(React11.createElement(App));
  if (!/Flux|Turbo|DALL/.test(html21b)) throw new Error('chip does not name the image model');
  A11.setSettings({ autoIntent: true, mode: 'team' });
  console.log('[21] model chip — visible button names the answering model ✓ · real model list in the menu ✓ · solo + image lanes ✓');
}
function modelLabelSafeguard(p, m) {
  try { return ml21 ? ml21(p, m) : ''; } catch { return ''; }
}

// 22 · main loader + folded badges — the unified loading experience
{
  const NL22 = await import('../src/components/NexusLoader.jsx');
  if (!NL22.LOADER_TEXT.thinking || !NL22.LOADER_TEXT.searching || !NL22.LOADER_TEXT.drawing) throw new Error('phase texts missing');
  for (const p of ['thinking','searching','planning','designing','coding','drawing','writing','testing','previewing']) {
    if (!/NEXUSAI is /.test(NL22.LOADER_TEXT[p])) throw new Error('phase text wrong: ' + p);
  }
  if (NL22.TEAM_PHASE.research !== 'searching' || NL22.IMAGE_PHASE.generate !== 'drawing' || NL22.PROJECT_PHASE.Testing !== 'testing') throw new Error('stage maps wrong');

  // loader renders: hexagon + crossfade text + sub detail
  const htmlL22 = renderToString(React11.createElement(NL22.default, { phase: 'coding', sub: 'writing js/app.js' }));
  for (const piece of ['nx-hex', 'nx-loader', 'NEXUSAI is coding…', 'writing js/app.js']) {
    if (!htmlL22.includes(piece)) throw new Error('loader missing: ' + piece);
  }

  // crossfade CSS exists (in AND out animations = fading start→end and end→start)
  const css22 = (await import('node:fs')).readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const piece of ['@keyframes ftIn', '@keyframes ftOut', '@keyframes nxPulse', '@keyframes nxGlow', '@keyframes nxRing', '.fold-head', '.fold-body', '--acc: #6db3ff']) {
    if (!css22.includes(piece)) throw new Error('loader/badge css missing: ' + piece);
  }

  // Fold: folded by default, opens on click (state) — render closed then verify no body
  const { Fold: Fold22 } = NL22;
  const foldClosed22 = renderToString(React11.createElement(Fold22, { label: 'Coded 5 files' }, 'detail here'));
  if (!foldClosed22.includes('Coded 5 files') || !foldClosed22.includes('fold-head')) throw new Error('fold badge head missing');
  if (foldClosed22.includes('detail here')) throw new Error('fold is open by default — must be folded');

  // solo finished message gets the Thought-for badge
  const Message22 = (await import('../src/components/Message.jsx')).default;
  const msg22 = { id: 's22', role: 'assistant', mode: 'solo', kind: undefined, streaming: false, ms: 5200, content: 'answer text here', reasoning: 'chain of thought' };
  const htmlS22 = renderToString(React11.createElement(Message22, { msg: msg22, isLast: false }));
  if (!/Thought for 5\.2s/.test(htmlS22)) throw new Error('solo thought-time badge missing');
  console.log('[22] main loader — 9 phase texts ✓ · hexagon+crossfade+sub ✓ · css (ftIn/ftOut/nxPulse/nxGlow/nxRing) ✓ · folds folded-by-default ✓ · solo thought badge ✓');
}

// 23 · image engine — flagship escalation, forced ladder, disk cache
{
  const fs23 = await import('node:fs');
  try { fs23.rmSync(new URL('../.cache/imgengine', import.meta.url), { recursive: true, force: true }); } catch {} // fresh cache per run
  const engine23 = await import('../server/imagegen.js');
  const { IMAGE_PROVIDERS: IP23 } = await import('../shared/providers.js');

  // registry: engine is the first, keyless, flagship-flagged
  const eng23 = IP23[0];
  if (eng23.id !== 'nexus-engine' || eng23.needsKey || eng23.kind !== 'server-image') throw new Error('engine registry entry wrong');
  if (!eng23.models.some((m) => m.id === 'black-forest-labs/flux.2-pro' && m.tags.includes('BEST'))) throw new Error('flagship model missing');

  // buildUrl shape
  const url23 = engine23.buildUrl({ prompt: 'a tesla logo', model: 'black-forest-labs/flux.2-pro', w: 1024, h: 768, seed: 42 });
  if (!url23.startsWith('https://image.pollinations.ai/prompt/a%20tesla%20logo?') || !url23.includes('model=black-forest-labs%2Fflux.2-pro') || !url23.includes('seed=42')) throw new Error('engine url wrong: ' + url23);

  // escalation: flagship 500s → gemini returns non-image → schnell succeeds
  const png23 = Buffer.from('89504e470d0a1a0a' + 'ab'.repeat(2048), 'hex');
  const seen23 = [];
  const out23 = await engine23.generateImage({ prompt: 'escalation test', w: 512, h: 512, seed: 7 }, async (url) => {
    seen23.push(url);
    if (url.includes('flux.2-pro')) return { ok: false, status: 500 };
    if (url.includes('gemini')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, arrayBuffer: async () => new ArrayBuffer(10) };
    return { ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => png23.buffer.slice(png23.byteOffset, png23.byteOffset + png23.length) };
  });
  if (out23.model !== 'black-forest-labs/flux.1-schnell' || out23.cached) throw new Error('escalation wrong: ' + JSON.stringify(out23.model));
  if (seen23.length !== 3) throw new Error('ladder tried wrong number of models: ' + seen23.length);

  // cache: the schnell result is now served from disk — no fetch for THAT rung
  // (other rungs may probe their own caches and miss; that's the ladder)
  const urls23b = [];
  const out23b = await engine23.generateImage({ prompt: 'escalation test', w: 512, h: 512, seed: 7 }, async (url) => { urls23b.push(url); throw new Error('down'); });
  if (!out23b.cached || out23b.model !== out23.model) throw new Error('disk cache miss');
  if (urls23b.some((u) => u.includes('schnell'))) throw new Error('cached rung still hit the network');

  // requested model goes first, then the ladder
  const seen23c = [];
  await engine23.generateImage({ prompt: 'custom first', model: 'x-ai/grok-imagine-image-2.0', w: 256, h: 256, seed: 9 }, async (url) => {
    seen23c.push(url);
    return { ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => png23.buffer.slice(png23.byteOffset, png23.byteOffset + png23.length) };
  });
  if (!seen23c[0].includes('grok-imagine')) throw new Error('custom model not tried first');

  // all rungs fail → error names every model
  let msg23 = '';
  try { await engine23.generateImage({ prompt: 'doomed', w: 64, h: 64, seed: 1 }, async () => ({ ok: false, status: 429 })); } catch (e) { msg23 = e.message; }
  if (!/flux\.2-pro.*gemini.*schnell.*z-image/s.test(msg23)) throw new Error('failure message missing ladder: ' + msg23);

  // client transport: server-image kind → data URL
  const realFetch23 = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/generate')) {
      const body23 = JSON.parse(opts.body);
      if (!body23.prompt || !body23.model) throw new Error('engine call missing params');
      return { ok: true, json: async () => ({ ok: true, b64: 'aW1n', model: body23.model, contentType: 'image/png', cached: true }) };
    }
    return realFetch23(url, opts);
  };
  const { generateImage: gi23 } = await import('../src/lib/images.js');
  const img23 = await gi23({ provider: 'nexus-engine', model: 'black-forest-labs/flux.2-pro', prompt: 'a tesla logo', w: 1024, h: 1024, aspect: '1:1' });
  globalThis.fetch = realFetch23;
  if (!img23.src.startsWith('data:image/png;base64,') || img23.model !== 'black-forest-labs/flux.2-pro' || img23.provider !== 'nexus-engine') throw new Error('client engine transport wrong');

  // live route on the running server: seed the cache, then POST — must answer from cache
  engine23.cachePut({ prompt: 'cached route test', model: 'black-forest-labs/flux.2-pro', w: 300, h: 300, seed: 55 }, png23, 'image/png', 'black-forest-labs/flux.2-pro');
  const rr23 = await realFetch23('http://localhost:8787/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'cached route test', model: 'black-forest-labs/flux.2-pro', w: 300, h: 300, seed: 55 }),
  });
  const rj23 = await rr23.json();
  if (!rr23.ok || !rj23.ok || !rj23.cached || rj23.model !== 'black-forest-labs/flux.2-pro') throw new Error('live /api/generate cache route wrong: ' + JSON.stringify(rj23));
  const r40023 = await realFetch23('http://localhost:8787/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  if (r40023.status !== 400) throw new Error('empty prompt should 400');
  console.log(`[23] image engine — flagship ladder ✓ (3 rungs walked) · disk cache hit, zero network ✓ · custom-model-first ✓ · all-fail lists every rung ✓ · client transport ✓ · live /api/generate cached ✓`);
}

// 24 · one loader, honest fallbacks, gemini image
{
  const Message24 = (await import('../src/components/Message.jsx')).default;
  const { autoConfigure: ac24 } = await import('../src/lib/autobest.js');

  // ── double-loader fix: streaming image message with stages = exactly ONE loader
  const msgRun24 = { id: 'r24', role: 'assistant', kind: 'image', mode: 'image', streaming: true, images: [], istages: [
    { stage: 'research', status: 'done' }, { stage: 'enhance', status: 'done' }, { stage: 'generate', status: 'run', detail: 'image 1/1' },
  ] };
  const htmlRun24 = renderToString(React11.createElement(Message24, { msg: msgRun24, isLast: true }));
  const hexCount24 = (htmlRun24.match(/nx-hex/g) || []).length;
  const thinkCount24 = (htmlRun24.match(/NEXUSAI is /g) || []).length;
  if (hexCount24 !== 1 || thinkCount24 !== 1) throw new Error(`expected exactly one loader, got hex=${hexCount24} text=${thinkCount24}`);
  // no stages yet → still exactly one (the early wait)
  const msgEarly24 = { id: 'e24', role: 'assistant', kind: 'image', mode: 'image', streaming: true, images: [] };
  const htmlEarly24 = renderToString(React11.createElement(Message24, { msg: msgEarly24, isLast: true }));
  if ((htmlEarly24.match(/nx-hex/g) || []).length !== 1) throw new Error('early image wait loader count wrong');

  // ── honest fallback: fold line says who stood in for whom
  const msgDone24 = { id: 'd24', role: 'assistant', kind: 'image', mode: 'image', streaming: false, images: [
    { src: 'blob:z', w: 1024, h: 1024, model: 'black-forest-labs/flux.1-schnell', requestedModel: 'google/gemini-3.1-flash-image', fellBack: true, check: 'pass' },
  ], istages: [
    { stage: 'research', status: 'done' }, { stage: 'enhance', status: 'done' }, { stage: 'generate', status: 'done' },
    { stage: 'upscale', status: 'done' }, { stage: 'check', status: 'done' },
  ], enhancedPrompt: 'x' };
  const htmlDone24 = renderToString(React11.createElement(Message24, { msg: msgDone24, isLast: false }));
  if (!/Drew 1 image/.test(htmlDone24) || !/Previewed — 1\/1 PASS/.test(htmlDone24)) throw new Error('fold heads missing');
  const { imageModelLabel: lbl24 } = await import('../src/lib/images.js');
  if (lbl24('black-forest-labs/flux.1-schnell') !== 'FLUX schnell' || lbl24('gemini-3.1-flash-image') !== 'Gemini 3.1 Flash Image' || lbl24('unknown-model-x') !== 'unknown-model-x') throw new Error('image model labels wrong');
  const src24 = (await import('node:fs')).readFileSync(new URL('../src/components/Message.jsx', import.meta.url), 'utf8');
  if (!/stood in for/.test(src24) || !src24.includes('fellBack')) throw new Error('fallback credit wiring missing from the fold body');

  // ── gemini image transport: keyless error + full request shape
  const { generateImage: gi24 } = await import('../src/lib/images.js');
  let err24 = '';
  try { await gi24({ provider: 'gemini-image', model: 'gemini-2.5-flash-image', prompt: 'x', apiKey: '' }); } catch (e) { err24 = e.message; }
  if (!/Google AI Studio key/.test(err24)) throw new Error('missing-key error not helpful: ' + err24);
  const realFetch24 = globalThis.fetch;
  let geminiReq24 = null;
  globalThis.fetch = async (url, opts) => {
    geminiReq24 = { url, opts };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1n' } }] } }] }) };
  };
  const g24 = await gi24({ provider: 'gemini-image', model: 'gemini-3.1-flash-image', prompt: 'a tesla logo', aspect: '16:9', w: 1280, h: 720, apiKey: 'AIza-test' });
  globalThis.fetch = realFetch24;
  if (!g24.src.startsWith('data:image/png;base64,')) throw new Error('gemini image src wrong');
  if (!geminiReq24.url.includes('gemini-3.1-flash-image:generateContent')) throw new Error('gemini url wrong');
  if (geminiReq24.opts.headers['x-goog-api-key'] !== 'AIza-test') throw new Error('gemini key header wrong');
  const body24 = JSON.parse(geminiReq24.opts.body);
  if (!body24.generationConfig.responseModalities.includes('IMAGE')) throw new Error('responseModalities missing');
  if (body24.generationConfig.imageConfig?.aspectRatio !== '3:2') throw new Error('native aspect config missing (16:9 → 3:2)');
  if (g24.fellBack) throw new Error('no fallback should happen when the model answers');

  // ── autobest: gemini key promotes images to Gemini 2.5 Flash Image
  const st24 = { keys: { gemini: 'AIza-x' }, envKeys: [], solo: {}, squad: { workers: [], planner: {}, critic: {}, synth: {} }, prj: {}, image: { provider: 'nexus-engine', model: 'black-forest-labs/flux.2-pro' } };
  const img24 = ac24(st24).image;
  if (img24.provider !== 'gemini-image' || img24.model !== 'gemini-3.1-flash-image') throw new Error('gemini image promotion missing: ' + JSON.stringify(img24));
  // no keys at all → engine default stays
  const img24b = ac24({ keys: {}, envKeys: [], solo: {}, squad: { workers: [], planner: {}, critic: {}, synth: {} }, prj: {}, image: { provider: 'pollinations', model: 'flux' } }).image;
  if (img24b.provider !== 'nexus-engine') throw new Error('no-key default should be engine');

  // ── engine route passes fallback truth (cached entry from test 23 still there)
  const rr24 = await realFetch24('http://localhost:8787/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'cached route test', model: 'black-forest-labs/flux.2-pro', w: 300, h: 300, seed: 55 }),
  });
  const rj24 = await rr24.json();
  if (!rj24.ok || rj24.requested !== 'black-forest-labs/flux.2-pro' || typeof rj24.fellBack !== 'boolean') throw new Error('engine fallback truth missing from route');
  console.log(`[24] image fixes — exactly one loader ✓ · honest fallback credit ✓ · gemini image transport ✓ (key guard, headers, modalities, aspect hint) · autobest gemini promotion ✓ · engine fallback truth ✓`);
}

// 25 · gemini retirement self-heal — a dead model ID must not cost the image
{
  const { generateImage: gi25 } = await import('../src/lib/images.js');
  const { IMAGE_PROVIDERS: IP25 } = await import('../shared/providers.js');

  // the registry no longer lists retired models
  const g25 = IP25.find((p) => p.id === 'gemini-image');
  if (g25.models.some((m) => /2\.5-flash-image$|2\.0-flash-preview/.test(m.id))) throw new Error('retired gemini model still listed');
  if (!g25.models.some((m) => m.id === 'gemini-3.1-flash-image')) throw new Error('live model missing');

  // 404 on the picked model → walks the family ladder → lite answers, honestly
  const calls25 = [];
  const realFetch25 = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls25.push(String(url));
    if (url.includes('gemini-3.1-flash-image:')) return { status: 404, ok: false, json: async () => ({}) };
    if (url.includes('gemini-3.1-flash-lite-image:'))
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1n' } }] } }] }) };
    return { status: 404, ok: false, json: async () => ({}) };
  };
  const h25 = await gi25({ provider: 'gemini-image', model: 'gemini-3.1-flash-image', prompt: 'a dragon', aspect: '1:1', apiKey: 'AIza-x' });
  globalThis.fetch = realFetch25;
  if (h25.model !== 'gemini-3.1-flash-lite-image') throw new Error('heal did not walk to lite: ' + h25.model);
  if (!h25.fellBack || h25.requestedModel !== 'gemini-3.1-flash-image') throw new Error('heal not honest about the fallback');
  if (calls25.length !== 2) throw new Error('heal made wrong number of calls: ' + calls25.length);

  // a 401 (bad key) must NOT trigger model-walking — it fails fast with the message
  globalThis.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: { message: 'API key not valid' } }) });
  let e25 = '';
  try { await gi25({ provider: 'gemini-image', model: 'gemini-3.1-flash-image', prompt: 'x', apiKey: 'bad' }); } catch (err) { e25 = err.message; }
  globalThis.fetch = realFetch25;
  if (!/API key not valid/.test(e25)) throw new Error('401 should fail fast with the provider message: ' + e25);

  // every model retired → clear error naming the models tried
  globalThis.fetch = async () => ({ status: 404, ok: false, json: async () => ({}) });
  let e25b = '';
  try { await gi25({ provider: 'gemini-image', model: 'gemini-3.1-flash-image', prompt: 'x', apiKey: 'AIza-x' }); } catch (err) { e25b = err.message; }
  globalThis.fetch = realFetch25;
  if (!/404/.test(e25b) || !/gemini-3/.test(e25b)) throw new Error('all-retired error unclear: ' + e25b);
  console.log('[25] gemini self-heal — retired model 404 → lite ✓ honest ✓ · 401 fails fast ✓ · all-retired names the models ✓ · registry on live IDs ✓');
}

// 26 · v1.21 redesign — OLED black + saturated blue, Inter bold, no canvas, brand logo
{
  const css26 = (await import('node:fs')).readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const idx26 = (await import('node:fs')).readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const st26 = (await import('../src/lib/storage.js')).storage.loadSettings();

  // theme: saturated blue accent, deep OLED surfaces
  if (!/--acc: #2f6bff/.test(css26) || !/--acc-ink: #ffffff/.test(css26)) throw new Error('saturated blue accent missing');
  if (!/--bg: #000000/.test(css26) || !/--bg1: #08090e/.test(css26)) throw new Error('OLED black surfaces missing');
  if (!/[data-acc='blue']/.test(css26)) throw new Error('blue accent preset missing');
  // default + migration
  if (st26.accent !== 'blue') throw new Error('default accent is not blue: ' + st26.accent);
  if (!idx26.includes('data-acc="blue"')) throw new Error('html data-acc not blue');
  // Inter bold typography
  if (idx26.includes('Space+Grotesk') || idx26.includes('Space Grotesk')) throw new Error('Space Grotesk still loaded');
  if (!/Inter:wght@400;500;600;700;800;900/.test(idx26)) throw new Error('Inter weights not loaded');
  if (!/--font-d: 'Inter'/.test(css26)) throw new Error('display font is not Inter');
  if (!/body \{ font-weight: 500/.test(css26) && !/font-weight: 500/.test(css26)) throw new Error('base weight missing');

  // canvas removed everywhere
  const fs26 = await import('node:fs');
  if (fs26.existsSync(new URL('../src/components/CanvasView.jsx', import.meta.url))) throw new Error('CanvasView.jsx still exists');
  const appSrc26 = fs26.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  if (/canvas/i.test(appSrc26)) throw new Error('App still references canvas');
  const sbSrc26 = fs26.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
  const mbSrc26 = fs26.readFileSync(new URL('../src/components/MobileBar.jsx', import.meta.url), 'utf8');
  if (/label="Canvas"/.test(sbSrc26) || /canvas/.test(mbSrc26)) throw new Error('canvas nav still present');
  if (/\bcanvasview\b|\bcanvas-body\b|\bcanvas-editor\b/.test(css26)) throw new Error('canvas styles remain');

  // brand logo: custom-image override with vector fallback
  const icSrc26 = fs26.readFileSync(new URL('../src/components/Icons.jsx', import.meta.url), 'utf8');
  if (!icSrc26.includes('BrandLogo') || !icSrc26.includes('/logo.png') || !icSrc26.includes('onError')) throw new Error('BrandLogo override missing');
  if (!sbSrc26.includes('BrandLogo')) throw new Error('sidebar does not use BrandLogo');
  // live render: sidebar brand + hero render with the override img attempt
  A11.setView('chat');
  A11.newConversation();
  const html26 = renderToString(React11.createElement(App));
  if (!html26.includes('brandlogo-img')) throw new Error('brand logo not rendered');
  if (html26.includes('>Canvas<')) throw new Error('canvas label visible in render');
  console.log('[26] redesign — blue accent + OLED surfaces ✓ · Inter bold (900) ✓ · default+migration ✓ · canvas fully removed ✓ · BrandLogo override ✓');
}

// 27 · free-tier truth — current models only, no dead free claims
{
  const { PROVIDERS: P27, getProvider: gp27 } = await import('../shared/providers.js');
  const { autoConfigure: ac27 } = await import('../src/lib/autobest.js');

  // Gemini: current free models, retired/closed ones gone
  const gem27 = gp27('gemini');
  const gids27 = gem27.models.map((m) => m.id);
  if (!gids27.includes('gemini-3-flash') || !gids27.includes('gemini-3.1-flash-lite')) throw new Error('current Gemini free models missing');
  if (gids27.includes('gemini-2.0-flash') || gids27.includes('gemini-2.5-pro')) throw new Error('retired/closed Gemini models still listed');
  if (!gem27.models.find((m) => m.id === 'gemini-3-flash').tags.includes('SMART')) throw new Error('gemini-3-flash not flagged SMART');

  // Cerebras: free tier ended — must not claim FREE anywhere
  const cb27 = gp27('cerebras');
  if (cb27.free !== false || !/Paid/.test(cb27.vendor)) throw new Error('cerebras still advertised as free');
  if (cb27.models.some((m) => (m.tags || []).includes('FREE'))) throw new Error('cerebras models still tagged FREE');

  // OpenRouter: honest quota in the note
  if (!/50 requests\/day/.test(gp27('openrouter').note) || !/1,000\/day/.test(gp27('openrouter').note)) throw new Error('openrouter quota truth missing');

  // auto-best with ONLY a gemini key picks gemini-3-flash
  const st27 = { keys: { gemini: 'AIza-x' }, envKeys: [], solo: { provider: 'pollinations', model: 'openai' }, squad: { workers: [{ provider: 'pollinations', model: 'qwen-coder' }], planner: { provider: 'pollinations', model: 'mistral' }, critic: { provider: 'pollinations', model: 'mistral' }, synth: { provider: 'pollinations', model: 'openai' } }, prj: { provider: 'pollinations', model: 'qwen-coder' }, image: {} };
  const cfg27 = ac27(st27);
  if (cfg27.solo.provider !== 'gemini' || cfg27.solo.model !== 'gemini-3-flash') throw new Error('gemini key does not promote to gemini-3-flash: ' + JSON.stringify(cfg27.solo));
  if (cfg27.image.provider !== 'gemini-image') throw new Error('gemini key should also promote images');

  // every provider still tagged free actually has a plausible free path
  const free27 = P27.filter((p) => p.free && p.needsKey).map((p) => p.id);
  for (const must of ['gemini', 'groq', 'github', 'mistral', 'zai', 'nvidia', 'cohere', 'huggingface', 'openrouter']) {
    if (!free27.includes(must)) throw new Error('expected free provider missing from free set: ' + must);
  }
  console.log(`[27] free-tier truth — gemini-3-flash era ✓ · cerebras demoted (paid) ✓ · openrouter quota honest ✓ · gemini-key auto-best ✓ · free set: ${free27.length} providers ✓`);
}

console.log('\nALL SMOKE TESTS PASSED ⬡');
