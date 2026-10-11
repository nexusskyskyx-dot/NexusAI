import React, { useState } from 'react';
import { useStore, actions, hasCredential } from '../store.js';
import { PROVIDERS } from '@shared/providers.js';
import { completeChat } from '@lib/ai.js';
import { IconKeys, IconShield, IconExternal, IconEye, IconEyeOff, IconCheck, IconBolt, IconSettings } from './Icons.jsx';

function ProviderCard({ p }) {
  const s = useStore();
  const [val, setVal] = useState(s.keys[p.id] || '');
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

      {p.needsKey ? (
        <div className="provider-keyrow">
          <div className="provider-keyinput">
            <input
              type={show ? 'text' : 'password'}
              value={val}
              placeholder={`${p.id === 'openrouter' ? 'sk-or-v1-…' : 'paste your API key'}`}
              onChange={(e) => setVal(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="icon-btn" onClick={() => setShow((x) => !x)} title={show ? 'Hide' : 'Show'}>
              {show ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </button>
          </div>
          <button className="btn btn-acc btn-sm" disabled={!val.trim() && !saved} onClick={() => { actions.setKeys({ [p.id]: val.trim() }); actions.toast(`${p.name} key saved ✓`); setTestResult(null); }}>
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
        {p.id === 'openrouter' ? <span className="pmodel more">+ 390 more on openrouter.ai</span> : null}
      </div>
    </div>
  );
}

export default function KeysView() {
  const s = useStore();
  return (
    <div className="page keysview">
      <header className="page-head">
        <IconKeys size={22} />
        <div>
          <h1>Keys & models</h1>
          <p>Bring your own keys — they live in your browser only and go straight to the provider.</p>
        </div>
      </header>

      <div className="security-note">
        <IconShield size={16} />
        <div>
          <b>Zero-server-key architecture.</b> Keys are stored in your browser's localStorage, sent per-request either <b>directly to the provider</b> (Pollinations / OpenRouter / Claude) or through your local NexusAI proxy (OpenAI / DeepSeek / Qwen) — never persisted server-side. Running your own server? You can also set <code>OPENROUTER_API_KEY</code>, <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, <code>DEEPSEEK_API_KEY</code>, <code>DASHSCOPE_API_KEY</code> as environment variables instead.
        </div>
      </div>

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

      <div className="providers">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
