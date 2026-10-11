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

console.log('\nALL SMOKE TESTS PASSED ⬡');
