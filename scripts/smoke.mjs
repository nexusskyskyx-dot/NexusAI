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

console.log('\nALL SMOKE TESTS PASSED ⬡');
