import React, { useRef, useState, useEffect } from 'react';
import { useStore, actions } from '../store.js';
import ModelPicker from './ModelPicker.jsx';
import { IMAGE_PROVIDERS } from '@shared/providers.js';
import { IMAGE_ASPECTS } from '@lib/images.js';
import { IconSend, IconStop, IconAgents, IconBolt, IconImage, IconChevron, IconDownload } from './Icons.jsx';

function ImageModelPicker({ value, onChange }) {
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

  const prov = IMAGE_PROVIDERS.find((p) => p.id === value.provider) || IMAGE_PROVIDERS[0];
  const model = prov.models.find((m) => m.id === value.model) || prov.models[0];

  return (
    <div className="mpop" ref={ref}>
      <button className="model-chip" onClick={() => setOpen((o) => !o)} title="Pick image model">
        <IconImage size={13} />
        <span className="model-chip-model">{model?.label || value.model}</span>
        <IconChevron size={13} />
      </button>
      {open && (
        <div className="mpop-body">
          <div className="mp">
            <div className="mp-list">
              {IMAGE_PROVIDERS.map((p) => (
                <div key={p.id} className="mp-group">
                  <div className="mp-provider">
                    {p.name}
                    {!p.needsKey && <span className="tag tag-free">No key</span>}
                    {p.needsKey && <span className="tag tag-paid">OpenAI key</span>}
                  </div>
                  {p.models.map((m) => {
                    const sel = value.provider === p.id && value.model === m.id;
                    return (
                      <button
                        key={p.id + m.id}
                        className={`mp-model ${sel ? 'sel' : ''}`}
                        onClick={() => {
                          onChange({ provider: p.id, model: m.id });
                          setOpen(false);
                        }}
                      >
                        <span className="mp-model-label">
                          {m.label}
                          <span className="mp-model-id">{m.id}</span>
                        </span>
                        <span className="mp-tags">
                          {(m.tags || []).map((t) => (
                            <span key={t} className={`tag ${t === 'FREE' ? 'tag-free' : 'tag-paid'}`}>
                              {t}
                            </span>
                          ))}
                        </span>
                        {sel && <span className="mp-check">●</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Composer() {
  const s = useStore();
  const [text, setText] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
  }, [text]);

  const send = () => {
    if (!text.trim() || s.streaming) return;
    actions.sendMessage(text);
    setText('');
  };

  const mode = s.settings.mode || 'team';
  const img = s.image;
  const activeConv = s.conversations.find((x) => x.id === s.activeId);
  const convHasMsgs = !!activeConv?.messages?.length;
  const convHasTeam = !!activeConv?.messages?.some((m) => m.mode === 'team');
  return (
    <div className="composer-wrap">
      <div className="composer">
        {/* v1.15 · input first — controls live in one slim strip below */}
        <div className="composer-main">
          <textarea
            ref={taRef}
            value={text}
            placeholder={
              mode === 'team'
                ? 'Brief the team — the agents will collaborate on the best answer…'
                : mode === 'image'
                ? 'Describe the image to generate — e.g. “a neon city at night, cinematic, ultra detailed”…'
                : 'Ask NexusAI anything…'
            }
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
          />
          {s.streaming ? (
            <button className="btn-stop" onClick={() => actions.stopGeneration()} title="Stop generation" aria-label="Stop generation">
              <IconStop size={15} />
            </button>
          ) : (
            <button className="btn-send" onClick={send} disabled={!text.trim()} title="Send" aria-label="Send">
              {mode === 'image' ? <IconImage size={17} /> : <IconSend size={17} />}
            </button>
          )}
        </div>

        <div className="composer-bar">
          <div className="mode-switch" role="tablist">
            <button className={`mode-btn ${mode === 'solo' ? 'on' : ''}`} onClick={() => actions.setSettings({ mode: 'solo' })} title="One model answers directly">
              <IconBolt size={13} /> Solo
            </button>
            <button className={`mode-btn ${mode === 'team' ? 'on' : ''}`} onClick={() => actions.setSettings({ mode: 'team' })} title="Planner → Drafters → Reviewer → Synthesizer">
              <IconAgents size={13} /> Team
            </button>
            <button className={`mode-btn ${mode === 'image' ? 'on' : ''}`} onClick={() => actions.setSettings({ mode: 'image' })} title="Generate images">
              <IconImage size={13} /> Image
            </button>
          </div>

          <button
            className={`mode-btn web-toggle ${s.settings.web !== false ? 'on' : ''}`}
            onClick={() => actions.setSettings({ web: s.settings.web === false })}
            title="Researcher agent — searches the web (Wikipedia, DuckDuckGo, GitHub) and feeds the knowledge to every agent before they answer"
          >
            🌐 Web
          </button>

          {mode === 'solo' ? (
            <ModelPicker value={s.solo} onChange={(v) => actions.setSolo(v)} />
          ) : mode === 'team' ? (
            <button className="model-chip team-chip" onClick={() => actions.setView('agents')} title="Configure the agent squad">
              <span className="model-chip-dot" />
              {(s.squad.workers || []).filter((w) => w && w.model).length} drafters
              <span className="model-chip-sep">·</span>
              Configure
            </button>
          ) : null}

          <span className="composer-tools">
            {convHasTeam ? (
              <button className={`icon-btn ${s.agentsOpen ? 'on' : ''}`} onClick={() => actions.setAgentsOpen(!s.agentsOpen)} title="Agent pipeline">
                <IconAgents size={14} />
              </button>
            ) : null}
            {convHasMsgs ? (
              <button
                className="icon-btn"
                title="Export chat as Markdown"
                onClick={() => {
                  const conv = s.conversations.find((x) => x.id === s.activeId);
                  if (!conv) return;
                  const lines = [`# ${conv.title}`, ''];
                  for (const m of conv.messages) {
                    lines.push(m.role === 'user' ? `## 🧑 You` : `## ⬡ Assistant${m.model ? ` · ${m.model}` : ''}`);
                    lines.push(m.content || '(no text)');
                    if (m.images?.length) lines.push(`> ${m.images.length} image(s) attached`);
                    lines.push('');
                  }
                  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'nexusai-chat.md';
                  a.click();
                  URL.revokeObjectURL(a.href);
                  actions.toast('Chat exported as Markdown ✓');
                }}
              >
                <IconDownload size={14} />
              </button>
            ) : null}
          </span>

          <div className="composer-hint">Enter ↵ send · Shift+Enter newline</div>
        </div>

        {mode === 'image' ? (
          <div className="composer-xtra">
            <ImageModelPicker value={img} onChange={(v) => actions.setImage(v)} />
            <div className="aspect-row">
              {IMAGE_ASPECTS.map((a) => (
                <button key={a.id} className={`aspect-btn ${img.aspect === a.id ? 'on' : ''}`} onClick={() => actions.setImage({ aspect: a.id })} title={a.label}>
                  {a.id === '1:1' ? '◻' : a.id === '16:9' ? '▭' : '▯'}
                </button>
              ))}
            </div>
            <div className="aspect-row">
              {[1, 2, 4].map((n) => (
                <button key={n} className={`aspect-btn ${img.count === n ? 'on' : ''}`} onClick={() => actions.setImage({ count: n })} title={`${n} image${n > 1 ? 's' : ''}`}>
                  ×{n}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="composer-note">
        {mode === 'team'
          ? 'Planner briefs the drafters · reviewer merges · synthesizer ships the final answer'
          : mode === 'image'
          ? img.provider === 'pollinations'
            ? 'Free image generation via Pollinations — no key needed. Click a result to open the editor.'
            : 'DALL·E / GPT-Image via your OpenAI key. Click a result to open the editor.'
          : 'One model, streamed directly'}
      </div>
    </div>
  );
}
