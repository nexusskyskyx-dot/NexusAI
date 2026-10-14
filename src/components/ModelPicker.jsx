import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useStore, actions, hasCredential } from '../store.js';
import { PROVIDERS, getProvider } from '@shared/providers.js';
import { IconSearch, IconChevron } from './Icons.jsx';

export function ModelOptions({ value, onChange, compact = false }) {
  // Renders a <select>-like list of all models grouped by provider.
  const s = useStore();
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PROVIDERS.filter((p) => p.id !== 'demo' || showAll)
      .map((p) => {
        let models = s.liveModels[p.id] || p.models;
        if (p.id === 'demo' && !showAll) models = p.models;
        if (term) models = models.filter((m) => (m.label + ' ' + m.id).toLowerCase().includes(term));
        return { p, models };
      })
      .filter((g) => g.models.length && (showAll || hasCredential(g.p.id, s) || !g.p.needsKey));
  }, [q, showAll, s.keys, s.envKeys, s.liveModels]);

  return (
    <div className="mp">
      <div className="mp-search">
        <IconSearch size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" autoFocus />
      </div>
      <div className="mp-list">
        {groups.map(({ p, models }) => (
          <div key={p.id} className="mp-group">
            <div className="mp-provider">
              {p.name}
              {!p.needsKey && <span className="tag tag-free">NO KEY</span>}
              {p.needsKey && !hasCredential(p.id, s) && <span className="tag tag-warn">NEEDS KEY</span>}
            </div>
            {models.map((m) => {
              const selected = value.provider === p.id && value.model === m.id;
              return (
                <button key={p.id + m.id} className={`mp-model ${selected ? 'sel' : ''}`} onClick={() => onChange({ provider: p.id, model: m.id })}>
                  <span className="mp-model-label">
                    {m.label}
                    <span className="mp-model-id">{m.id}</span>
                  </span>
                  <span className="mp-tags">
                    {(m.tags || []).map((t) => (
                      <span key={t} className={`tag ${t === 'FREE' ? 'tag-free' : t === 'PAID' ? 'tag-paid' : 'tag-dim'}`}>
                        {t}
                      </span>
                    ))}
                  </span>
                  {selected && <span className="mp-check">●</span>}
                </button>
              );
            })}
          </div>
        ))}
        {!groups.length && <div className="mp-empty">No models match.</div>}
      </div>
      <label className="mp-all">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show providers without keys
      </label>
    </div>
  );
}

// Compact popover wrapper for the composer
export default function ModelPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const p = getProvider(value.provider);
  const model = p?.models.find((m) => m.id === value.model);
  const label = model?.label || value.model;

  return (
    <div className="mpop" ref={ref}>
      <button className="model-chip" onClick={() => setOpen((o) => !o)} title="Pick model">
        <span className="model-chip-dot" />
        <span className="model-chip-name">{p ? p.name : 'Model'}</span>
        <span className="model-chip-sep">/</span>
        <span className="model-chip-model">{label}</span>
        <IconChevron size={13} />
      </button>
      {open && (
        <div className="mpop-body">
          <ModelOptions
            value={value}
            onChange={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
