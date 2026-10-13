import React, { useState } from 'react';
import { useStore, actions, hasCredential } from '../store.js';
import { PROVIDERS, IMAGE_PROVIDERS, getProvider } from '@shared/providers.js';
import { completeChat } from '@lib/ai.js';
import { parseKeys, maskKey, exportEnv } from '@lib/keydetect.js';
import { IconKeys, IconShield, IconExternal, IconEye, IconEyeOff, IconCheck, IconBolt, IconSettings, IconImage, IconSparkle, IconDownload, IconRocket, IconX } from './Icons.jsx';

function ProviderCard({ p }) {
  const s = useStore();
  // never pre-fill the input with the saved key — it would put the raw key in
  // the DOM (SSR value attr, screen shares, accidental eye-toggle). Enter a new
  // key to replace; Test works off the saved one.
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'ok' | 'fail' | msg

  const saved = !!s.keys[p.id];
  const envKeyed = !saved && (s.envKeys || []).includes(p.id);
  const available = !p.needsKey || saved || envKeyed;
  const models = s.liveModels[p.id] || p.models;

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const out = await completeChat({
        provider: p.id,
        model: (models[0] || p.models[0]).id,
        messages: [{ role: 'user', content: 'Reply with exactly: NEXUS OK' }],
        apiKey: val || s.keys[p.id],
        maxTokens: 300,
        transport: s.settings.transport,
      });
      setTestResult(out && /nexus/i.test(out) ? 'ok' : `ok (reply: ${String(out).slice(0, 40)})`);
    } catch (e) {
      setTestResult('fail: ' + (e.message || 'error'));
    }
    setTesting(false);
  };

  return (
    <div className={`provider ${available ? 'ready' : ''} ${p.free ? 'free' : ''}`}>
      <div className="provider-head">
        <div className="provider-letter">{p.name[0]}</div>
        <div className="provider-id">
          <div className="provider-name">
            {p.name} <span className="provider-vendor">{p.vendor}</span>
          </div>
          <div className="provider-note">{p.note}</div>
        </div>
        <div className={`provider-status ${available ? 'ok' : 'nokey'}`}>
          <span className="led" />
          {available ? (p.needsKey ? (envKeyed ? 'Env key on server' : 'Key saved') : 'Ready — no key') : 'Key required'}
        </div>
      </div>

      {p.zeroCredit && available && p.needsKey ? (
        <div className="zero-credit-lane" title="The free models on this provider cost $0.00 — your key is never charged, no card needed">
          <IconBolt size={12} /> 0-credit lane — FREE models never bill your key
        </div>
      ) : null}

      {p.needsKey ? (
        <div className="provider-keyrow">
          <div className="provider-keyinput">
            <input
              type={show ? 'text' : 'password'}
              value={val}
              placeholder={saved ? 'key saved — paste a new one to replace' : p.id === 'openrouter' ? 'sk-or-v1-…' : 'paste your API key'}
              onChange={(e) => setVal(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="icon-btn" onClick={() => setShow((x) => !x)} title={show ? 'Hide' : 'Show'}>
              {show ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </button>
          </div>
          <button className="btn btn-acc btn-sm" disabled={!val.trim() && !saved} onClick={() => { if (!val.trim()) return; actions.setKeys({ [p.id]: val.trim() }); actions.toast(`${p.name} key saved ✓`); setVal(''); setTestResult(null); }}>
            Save
          </button>
          <button className="btn btn-ghost btn-sm" disabled={testing || (!val.trim() && !saved)} onClick={test}>
            {testing ? 'Testing…' : 'Test'}
          </button>
          {saved ? (
            <button className="btn btn-ghost btn-sm" onClick={() => { actions.removeKey(p.id); setVal(''); setTestResult(null); }}>
              Remove
            </button>
          ) : null}
          <a className="btn btn-ghost btn-sm" href={p.keyUrl} target="_blank" rel="noreferrer">
            Get key <IconExternal size={12} />
          </a>
        </div>
      ) : (
        <div className="provider-keyrow">
          <span className="provider-nokey">
            <IconBolt size={13} /> {p.free ? 'Works instantly — nothing to configure.' : ''}
          </span>
          {p.keyUrl ? (
            <a className="btn btn-ghost btn-sm" href={p.keyUrl} target="_blank" rel="noreferrer">
              Website <IconExternal size={12} />
            </a>
          ) : null}
        </div>
      )}

      {testResult ? (
        <div className={`provider-test ${String(testResult).startsWith('fail') ? 'bad' : 'good'}`}>
          {String(testResult).startsWith('fail') ? `⚠ ${testResult}` : <><IconCheck size={12} /> {testResult}</>}
        </div>
      ) : null}

      <div className="provider-models">
        {models.map((m) => (
          <span key={m.id} className="pmodel" title={m.id}>
            {m.label || m.id}
            {(m.tags || []).includes('FREE') ? <b className="tag tag-free">FREE</b> : null}
          </span>
        ))}
        {p.id === 'openrouter' ? <span className="pmodel more">+ {Math.max(370, 400 - models.length)} more on openrouter.ai</span> : null}
      </div>
    </div>
  );
}

// ── Quick Connect — paste anything, we detect what it is ─────────────────────
function SmartPaste() {
  const [text, setText] = useState('');
  const [ovr, setOvr] = useState({}); // per-row provider override (when detection is wrong)
  const [skip, setSkip] = useState([]); // removed row indices
  const rows = parseKeys(text).filter((_, i) => !skip.includes(i));
  const pickable = PROVIDERS.filter((p) => p.needsKey && p.id !== 'demo');

  const connect = () => {
    const patch = {};
    rows.forEach((r, i) => {
      const pid = ovr[i] || r.provider;
      if (pid) patch[pid] = r.key;
    });
    const n = Object.keys(patch).length;
    if (!n) return actions.toast('Pick a provider for your key first');
    actions.setKeys(patch);
    actions.toast(`${n} key${n > 1 ? 's' : ''} connected ✓`);
    setText('');
    setOvr({});
    setSkip([]);
  };

  return (
    <section className="panel quickconnect">
      <div className="panel-head">
        <h2>
          <IconSparkle size={15} /> Quick Connect
        </h2>
        <span className="qc-hint">paste one key, several keys, or your whole <code>.env</code> — NexusAI figures out the rest</span>
      </div>
      <textarea
        className="qc-paste"
        rows={rows.length ? 2 : 3}
        value={text}
        spellCheck="false"
        autoComplete="off"
        placeholder={'gsk_…   ·   sk-or-v1-…   ·   AIza…   ·   GROQ_API_KEY=gsk_…   ·   or paste your entire .env file'}
        onChange={(e) => {
          setText(e.target.value);
          setOvr({});
          setSkip([]);
        }}
      />
      {rows.length ? (
        <div className="qc-review">
          {rows.map((r, i) => {
            const pid = ovr[i] || r.provider;
            return (
              <div className={`qc-row ${pid ? '' : 'unknown'}`} key={i}>
                <span className="qc-led" />
                <select value={pid || ''} onChange={(e) => setOvr((o) => ({ ...o, [i]: e.target.value }))} title="Correct the provider if detection is wrong">
                  {!pid && <option value="">Choose provider…</option>}
                  {pickable.map((pp) => (
                    <option key={pp.id} value={pp.id}>
                      {pp.name}
                    </option>
                  ))}
                </select>
                <code className="qc-key">{maskKey(r.key)}</code>
                <span className="qc-how">
                  {r.how.startsWith('env:') ? r.how.slice(4) : r.how === 'prefix' ? (r.guess ? 'key format · best guess' : 'key format') : 'unrecognized — pick manually'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setSkip((x) => [...x, i])} title="Drop this key">
                  <IconX size={12} />
                </button>
              </div>
            );
          })}
          <div className="qc-actions">
            <button className="btn btn-acc" onClick={connect}>
              <IconBolt size={14} /> Connect {rows.filter((r, i) => ovr[i] || r.provider).length} key{rows.filter((r, i) => ovr[i] || r.provider).length === 1 ? '' : 's'}
            </button>
            <span className="qc-hint">keys stay in your browser — nothing is sent anywhere until you chat</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── first-run guide — zero keys? three 60-second paths ──────────────────────
const QUICK_IDS = ['groq', 'gemini', 'openrouter'];

function QuickCard({ p }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div className="qs-card">
      <div className="qs-head">
        <div className="provider-letter">{p.name[0]}</div>
        <div>
          <b>{p.name}</b>
          <span>{p.vendor}</span>
        </div>
      </div>
      <ol className="qs-steps">
        <li>
          Open the <a href={p.keyUrl} target="_blank" rel="noreferrer">console <IconExternal size={11} /></a> and sign up (free)
        </li>
        <li>Copy your API key</li>
        <li>Paste it below</li>
      </ol>
      <div className="qs-input">
        <input type={show ? 'text' : 'password'} value={val} placeholder="paste key…" spellCheck="false" autoComplete="off" onChange={(e) => setVal(e.target.value)} />
        <button className="icon-btn" onClick={() => setShow((x) => !x)} title={show ? 'Hide' : 'Show'}>
          {show ? <IconEyeOff size={13} /> : <IconEye size={13} />}
        </button>
        <button
          className="btn btn-acc btn-sm"
          disabled={!val.trim()}
          onClick={() => {
            actions.setKeys({ [p.id]: val.trim() });
            actions.toast(`${p.name} connected ✓`);
            setVal('');
          }}
        >
          Connect
        </button>
      </div>
    </div>
  );
}

function QuickStart() {
  return (
    <section className="panel quickstart">
      <div className="panel-head">
        <h2>
          <IconRocket size={15} /> Get your first key — 60 seconds
        </h2>
        <span className="qc-hint">three best free paths, ranked by how fast you can start</span>
      </div>
      <div className="qs-grid">
        {QUICK_IDS.map((id) => {
          const p = getProvider(id);
          return p ? <QuickCard key={id} p={p} /> : null;
        })}
      </div>
    </section>
  );
}

export default function KeysView() {
  const s = useStore();
  const [filter, setFilter] = useState('all'); // all | free | connected
  const [bulk, setBulk] = useState(null); // { running, results:{pid:'ok'|'fail'} }

  const savedIds = Object.keys(s.keys).filter((pid) => getProvider(pid) && getProvider(pid).needsKey);
  const connectedIds = PROVIDERS.filter((p) => hasCredential(p.id, s)).map((p) => p.id);
  const zeroKeys = savedIds.length === 0 && (s.envKeys || []).length === 0;

  const exportKeys = () => {
    const env = exportEnv(s.keys);
    if (!env) return actions.toast('No keys to export yet');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([env], { type: 'text/plain' }));
    a.download = 'nexusai-keys.env';
    a.click();
    URL.revokeObjectURL(a.href);
    actions.toast('Key backup downloaded ✓ — import it anywhere with Quick Connect');
  };

  const checkAll = async () => {
    setBulk({ running: true, results: {} });
    const results = {};
    await Promise.all(
      savedIds.map(async (pid) => {
        const p = getProvider(pid);
        const models = s.liveModels[pid] || p.models;
        try {
          const out = await completeChat({
            provider: pid,
            model: (models[0] || p.models[0]).id,
            messages: [{ role: 'user', content: 'Reply with exactly: NEXUS OK' }],
            apiKey: s.keys[pid],
            maxTokens: 300,
            transport: s.settings.transport,
          });
          results[pid] = out ? 'ok' : 'fail';
        } catch {
          results[pid] = 'fail';
        }
        setBulk({ running: true, results: { ...results } });
      })
    );
    setBulk({ running: false, results });
    const ok = Object.values(results).filter((x) => x === 'ok').length;
    actions.toast(ok === savedIds.length ? `All ${ok} keys working ✓` : `${ok}/${savedIds.length} keys working — the rest need attention`);
  };

  const shown = PROVIDERS.filter((p) => filter === 'all' || (filter === 'free' && p.free) || (filter === 'connected' && hasCredential(p.id, s)));

  return (
    <div className="page keysview">
      <header className="page-head">
        <IconKeys size={22} />
        <div>
          <h1>Keys & models</h1>
          <p>Bring your own keys — they live in your browser only and go straight to the provider.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={exportKeys} title="Download all saved keys as a .env backup">
            <IconDownload size={13} /> Backup
          </button>
          {savedIds.length ? (
            <button className="btn btn-acc btn-sm" disabled={bulk?.running} onClick={checkAll}>
              {bulk?.running ? `Checking ${Object.keys(bulk.results).length}/${savedIds.length}…` : `Check all ${savedIds.length}`}
            </button>
          ) : null}
        </div>
      </header>

      {bulk && !bulk.running ? (
        <div className="bulk-bar">
          {savedIds.map((pid) => {
            const r = bulk.results[pid];
            return (
              <span key={pid} className={`bulk-pill ${r === undefined ? 'pending' : r}`}>
                {getProvider(pid)?.name || pid} {r === 'ok' ? <IconCheck size={11} /> : r === 'fail' ? '✕' : '…'}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="security-note">
        <IconShield size={16} />
        <div>
          <b>Zero-server-key architecture.</b> Keys are stored in your browser's localStorage, sent per-request either <b>directly to the provider</b> (Pollinations / OpenRouter / Claude) or through your local NexusAI proxy (OpenAI / DeepSeek / Qwen) — never persisted server-side. Running your own server? You can also set <code>OPENROUTER_API_KEY</code>, <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, <code>DEEPSEEK_API_KEY</code>, <code>DASHSCOPE_API_KEY</code>, <code>GROQ_API_KEY</code>, <code>GEMINI_API_KEY</code>, <code>GITHUB_MODELS_TOKEN</code>, <code>MISTRAL_API_KEY</code>, <code>CEREBRAS_API_KEY</code> as environment variables instead.
        </div>
      </div>

      <SmartPaste />
      {zeroKeys ? <QuickStart /> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>
            <IconSettings size={15} /> Connection
          </h2>
        </div>
        <div className="transport-row">
          <span className="transport-label">Transport mode:</span>
          {['auto', 'direct', 'proxy'].map((t) => (
            <button key={t} className={`btn btn-sm ${s.settings.transport === t ? 'btn-acc' : 'btn-ghost'}`} onClick={() => actions.setSettings({ transport: t })}>
              {t.toUpperCase()}
            </button>
          ))}
          <span className="transport-hint">
            AUTO = browser-direct when the provider allows it (keys never touch a server), proxy fallback. PROXY = everything via the NexusAI server.
          </span>
        </div>
        <div className="transport-row">
          <span className="transport-label">Creativity:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={s.settings.temperature}
            onChange={(e) => actions.setSettings({ temperature: parseFloat(e.target.value) })}
          />
          <b className="transport-val">{s.settings.temperature.toFixed(2)}</b>
          <span className="transport-label" style={{ marginLeft: 18 }}>Max tokens:</span>
          <input
            className="input-mini"
            type="number"
            min="256"
            max="16000"
            step="256"
            value={s.settings.maxTokens}
            onChange={(e) => actions.setSettings({ maxTokens: Math.max(256, Math.min(16000, parseInt(e.target.value || '4000', 10))) })}
          />
        </div>
      </section>

      <div className="filter-row">
        <span className="transport-label">Providers:</span>
        {[
          ['all', `All ${PROVIDERS.length}`],
          ['free', `Free ${PROVIDERS.filter((p) => p.free).length}`],
          ['connected', `Connected ${connectedIds.length}`],
        ].map(([id, label]) => (
          <button key={id} className={`btn btn-sm ${filter === id ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="providers">
        {shown.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>


      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>
            <IconImage size={15} /> Image generation
          </h2>
        </div>
        <div className="providers">
          {IMAGE_PROVIDERS.map((p) => {
            const credId = p.keyRef || p.id;
            const ready = !p.needsKey || hasCredential(credId, s);
            return (
              <div key={p.id} className={`provider ${ready ? 'ready' : ''} ${p.free ? 'free' : ''}`}>
                <div className="provider-head">
                  <div className="provider-letter">{p.name[0]}</div>
                  <div className="provider-id">
                    <div className="provider-name">
                      {p.name} <span className="provider-vendor">{p.vendor}</span>
                    </div>
                    <div className="provider-note">{p.note}</div>
                  </div>
                  <div className={`provider-status ${ready ? 'ok' : 'nokey'}`}>
                    <span className="led" />
                    {ready ? (p.needsKey ? 'Key ready' : 'Ready — no key') : 'Needs OpenAI key'}
                  </div>
                </div>
                <div className="provider-models">
                  {p.models.map((m) => (
                    <span key={m.id} className="pmodel" title={m.id}>
                      {m.label}
                      {(m.tags || []).includes('FREE') ? <b className="tag tag-free">Free</b> : <b className="tag tag-paid">Paid</b>}
                    </span>
                  ))}
                </div>
                {p.keyUrl ? (
                  <div className="provider-keyrow">
                    <a className="btn btn-ghost btn-sm" href={p.keyUrl} target="_blank" rel="noreferrer">
                      Get key <IconExternal size={12} />
                    </a>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
