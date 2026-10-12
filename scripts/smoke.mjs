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
  if (!html.includes('worksum')) throw new Error('finished team message missing the collapsed worklog summary');
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
for (const v of ['agents', 'canvas', 'keys']) {
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

console.log('\nALL SMOKE TESTS PASSED ⬡');
