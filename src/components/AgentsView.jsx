import React from 'react';
import { useStore, actions, recommendedSquad, hasCredential } from '../store.js';
import { PROVIDERS } from '@shared/providers.js';
import { IconAgents, IconBolt, IconBrain, IconEye, IconSparkle, IconTrash } from './Icons.jsx';

const STAGES = [
  { icon: <IconBolt size={20} />, name: 'PLANNER', desc: 'Reads your request and writes a tight brief: goal, requirements, approach, style.' },
  { icon: <IconAgents size={20} />, name: 'DRAFTERS', desc: 'Up to 4 different models (DeepSeek, Qwen, Claude, GPT…) answer in parallel, each following the brief.' },
  { icon: <IconEye size={20} />, name: 'REVIEWER', desc: 'Compares every draft, picks the strongest and writes a merge plan: keep, fix, add.' },
  { icon: <IconSparkle size={20} />, name: 'SYNTHESIZER', desc: 'Fuses the best draft with the review notes and streams the final answer to your chat.' },
];

function SlotPicker({ label, value, onChange, hint }) {
  const s = useStore();
  const providers = PROVIDERS;
  const provider = providers.find((p) => p.id === value.provider) || providers[0];
  const models = s.liveModels[provider.id] || provider.models;

  return (
    <div className="slot">
      <div className="slot-label">
        {label}
        {hint ? <span className="slot-hint">{hint}</span> : null}
      </div>
      <div className="slot-pickers">
        <select
          className="sel"
          value={value.provider}
          onChange={(e) => {
            const p = providers.find((x) => x.id === e.target.value);
            onChange({ provider: p.id, model: (s.liveModels[p.id] || p.models)[0]?.id || p.models[0]?.id });
          }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.needsKey && !s.keys[p.id] ? ' (no key)' : ''}
            </option>
          ))}
        </select>
        <select className="sel" value={value.model} onChange={(e) => onChange({ provider: value.provider, model: e.target.value })}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label || m.id}
            </option>
          ))}
        </select>
      </div>
      {value.provider && provider.needsKey && !hasCredential(value.provider, s) ? (
        <div className="slot-warn">⚠ No key set for {provider.name} — this agent will fail. Add keys in Keys & Models.</div>
      ) : null}
    </div>
  );
}

export default function AgentsView() {
  const s = useStore();
  const squad = s.squad;
  const workers = squad.workers || [];

  const setWorker = (i, v) => {
    const next = workers.map((w, j) => (j === i ? v : w));
    actions.setSquad({ workers: next });
  };
  const addWorker = () => {
    if (workers.length >= 4) return;
    const rec = recommendedSquad();
    const used = new Set(workers.map((w) => w.provider + w.model));
    const candidate =
      [...rec.workers, rec.planner, rec.critic, rec.synth, { provider: 'pollinations', model: 'mistral' }, { provider: 'demo', model: 'nexus-demo' }].find(
        (c) => c && !used.has(c.provider + c.model)
      ) || { provider: 'demo', model: 'nexus-demo' };
    actions.setSquad({ workers: [...workers, candidate] });
  };
  const removeWorker = (i) => actions.setSquad({ workers: workers.filter((_, j) => j !== i) });

  const activeWorkers = workers.filter((w) => w && w.model && hasCredential(w.provider, s)).length;

  return (
    <div className="page agentsview">
      <header className="page-head">
        <IconAgents size={22} />
        <div>
          <h1>Agent squad</h1>
          <p>Configure the models that collaborate on every Team-mode answer.</p>
        </div>
      </header>

      <section className="stage-cards">
        {STAGES.map((st, i) => (
          <div key={st.name} className="stage-card">
            <div className="stage-card-ico">{st.icon}</div>
            <div className="stage-card-num">0{i + 1}</div>
            <div className="stage-card-name">{st.name}</div>
            <div className="stage-card-desc">{st.desc}</div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Drafters — parallel competitors</h2>
          <div className="panel-actions">
            <button className="btn btn-ghost btn-sm" onClick={addWorker} disabled={workers.length >= 4}>
              + Add drafter
            </button>
            <button className="btn btn-acc btn-sm" onClick={() => { actions.applyRecommendedSquad(); actions.toast('Recommended squad applied ⚡'); }}>
              Recommended squad
            </button>
          </div>
        </div>
        <div className="workers">
          {workers.map((w, i) => (
            <div className="worker-row" key={i}>
              <span className="worker-letter">{String.fromCharCode(65 + i)}</span>
              <SlotPicker label={`Drafter ${String.fromCharCode(65 + i)}`} value={w} onChange={(v) => setWorker(i, v)} />
              <button className="icon-btn worker-del" onClick={() => removeWorker(i)} title="Remove drafter">
                <IconTrash size={14} />
              </button>
            </div>
          ))}
          {!workers.length ? <div className="slot-warn">⚠ Add at least one drafter.</div> : null}
        </div>
        <div className="squad-note">
          <span className={`led ${activeWorkers ? 'ok' : 'bad'}`} />
          {activeWorkers} of {workers.length} drafters have working credentials.{' '}
          {activeWorkers < workers.length ? 'Add keys in Keys & Models or use the Recommended Squad.' : 'Squad is ready.'}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Control agents</h2>
          <div className="panel-actions">
            <label className="toggle">
              <input type="checkbox" checked={s.settings.planner !== false} onChange={(e) => actions.setSettings({ planner: e.target.checked })} />
              Planner
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.settings.critic !== false} onChange={(e) => actions.setSettings({ critic: e.target.checked })} />
              Reviewer
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.settings.stagger !== false} onChange={(e) => actions.setSettings({ stagger: e.target.checked })} />
              Stagger (rate-limit safety)
            </label>
          </div>
        </div>
        <div className="ctrl-grid">
          <SlotPicker label="⌘ Planner model" value={squad.planner} onChange={(v) => actions.setSquad({ planner: v })} hint="writes the brief" />
          <SlotPicker label="☰ Reviewer model" value={squad.critic} onChange={(v) => actions.setSquad({ critic: v })} hint="judges the drafts" />
          <SlotPicker label="★ Synthesizer model" value={squad.synth} onChange={(v) => actions.setSquad({ synth: v })} hint="writes the final answer" />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent team runs</h2>
        </div>
        {s.runs.length === 0 ? (
          <div className="agents-empty">No team runs yet — send a message in Team mode.</div>
        ) : (
          <div className="runs">
            {s.runs.map((r, i) => (
              <div className="run" key={i}>
                <div className="run-prompt">{r.prompt || '—'}</div>
                <div className="run-meta">
                  {r.models?.map((m, j) => (
                    <span key={j} className="team-model">◆ {m}</span>
                  ))}
                  <span className="run-time">{(r.ms / 1000).toFixed(1)}s total agent time</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
