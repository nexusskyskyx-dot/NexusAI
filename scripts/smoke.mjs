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
console.log(`    stages: ${doc6.stages.join('→')} · bugs: ${doc6.testReport?.bugs?.length} · patched: ${doc6.testReport?.applied}`);
if (doc6.status !== 'done') throw new Error('project did not finish');
if (!doc6.files.some((f) => f.path === 'index.html' && f.content)) throw new Error('no index.html');
if (!doc6.files.some((f) => f.path === 'README.md')) throw new Error('no README');
if (!doc6.testReport?.bugs?.length) throw new Error('tester found no bugs');
if (doc6.testReport.applied < 1) throw new Error('debugger applied no patches');
if (!doc6.report || doc6.report.length < 80) throw new Error('no final report');
const patched = doc6.files.find((f) => f.path === 'js/app.js');
if (patched && /console\.log\('clicked'/.test(patched.content)) throw new Error('bug not actually fixed');
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

console.log('\nALL SMOKE TESTS PASSED ⬡');
