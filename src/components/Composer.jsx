import React, { useRef, useState, useEffect } from 'react';
import { useStore, actions, hasCredential } from '../store.js';
import { PROVIDERS, IMAGE_PROVIDERS } from '@shared/providers.js';
import { IMAGE_ASPECTS } from '@lib/images.js';
import { IconSend, IconStop, IconAgents, IconBolt, IconImage, IconChevron, IconDownload, IconSettings } from './Icons.jsx';
import { detectIntent, INTENT_LABEL } from '@lib/intent.js';

export default function Composer() {
  const s = useStore();
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const taRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

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
  const auto = s.settings.autoIntent !== false;
  const img = s.image;
  const activeConv = s.conversations.find((x) => x.id === s.activeId);
  const convHasMsgs = !!activeConv?.messages?.length;
  const convHasTeam = !!activeConv?.messages?.some((m) => m.mode === 'team');

  // 🧭 live verdict — what the user typed decides where it goes
  const intent = text.trim() && auto ? detectIntent(text) : null;
  const chipLabel = !auto
    ? INTENT_LABEL[mode] || '⬡ Team'
    : intent
    ? INTENT_LABEL[intent.mode]
    : '🧭 Auto';

  const exportChat = () => {
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
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        {/* v1.18 · input first — ONE intent chip + ONE menu, nothing else */}
        <div className="composer-main">
          <textarea
            ref={taRef}
            value={text}
            placeholder={auto ? 'Type anything — NexusAI routes it (image · project · research · chat)…' : `Ask NexusAI anything (${mode} mode)…`}
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
              {(auto ? intent?.mode === 'image' : mode === 'image') ? <IconImage size={17} /> : <IconSend size={17} />}
            </button>
          )}
        </div>

        <div className="composer-bar">
          <button
            className={`intent-chip ${intent ? 'live' : ''}`}
            onClick={() => setMenuOpen(true)}
            title={auto ? 'Auto-detected destination — click to change' : 'Manual mode — click to change'}
          >
            <span className="intent-led" />
            {chipLabel}
            <IconChevron size={12} />
          </button>

          {menuOpen ? (
            <div className="moremenu" ref={menuRef}>
              <div className="mm-row">
                <span className="mm-label">Routing</span>
                <div className="seg">
                  {[['auto', '🧭 Auto'], ['solo', '⚡ Solo'], ['team', '⬡ Team'], ['image', '🎨 Image']].map(([v, label]) => (
                    <button
                      key={v}
                      className={((v === 'auto' && auto) || (!auto && mode === v)) ? 'on' : ''}
                      onClick={() => actions.setSettings(v === 'auto' ? { autoIntent: true } : { autoIntent: false, mode: v })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mm-row">
                <span className="mm-label">🌐 Web research</span>
                <button className={`seg-toggle ${s.settings.web !== false ? 'on' : ''}`} onClick={() => actions.setSettings({ web: s.settings.web === false })}>
                  {s.settings.web !== false ? 'On' : 'Off'}
                </button>
              </div>
              <div className="mm-row">
                <span className="mm-label">Chat model</span>
                <select
                  className="mm-select"
                  value={s.solo.provider + '/' + s.solo.model}
                  onChange={(e) => {
                    const [provider, ...rest] = e.target.value.split('/');
                    actions.setSolo({ provider, model: rest.join('/') });
                  }}
                >
                  {PROVIDERS.filter((p) => p.id !== 'demo' && (!p.needsKey || hasCredential(p.id, s))).map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {(s.liveModels[p.id] || p.models).map((m) => (
                        <option key={p.id + m.id} value={p.id + '/' + m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {mode === 'image' || intent?.mode === 'image' ? (
                <>
                  <div className="mm-row">
                    <span className="mm-label">Image model</span>
                    <select
                      className="mm-select"
                      value={img.provider + '/' + img.model}
                      onChange={(e) => {
                        const [provider, ...rest] = e.target.value.split('/');
                        actions.setImage({ provider, model: rest.join('/') });
                      }}
                    >
                      {IMAGE_PROVIDERS.map((p) =>
                        p.models.map((m) => (
                          <option key={p.id + m.id} value={p.id + '/' + m.id}>
                            {p.name} · {m.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="mm-row">
                    <span className="mm-label">Aspect · count</span>
                    <div className="seg">
                      {IMAGE_ASPECTS.map((a) => (
                        <button key={a.id} className={img.aspect === a.id ? 'on' : ''} onClick={() => actions.setImage({ aspect: a.id })} title={a.label}>
                          {a.id === '1:1' ? '◻' : a.id === '16:9' ? '▭' : '▯'}
                        </button>
                      ))}
                      {[1, 2, 4].map((n) => (
                        <button key={n} className={img.count === n ? 'on' : ''} onClick={() => actions.setImage({ count: n })}>
                          ×{n}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              <div className="mm-row mm-links">
                {convHasTeam ? (
                  <button className="mm-link" onClick={() => { actions.setAgentsOpen(true); setMenuOpen(false); }}>
                    <IconAgents size={13} /> Agent pipeline
                  </button>
                ) : null}
                {convHasMsgs ? (
                  <button className="mm-link" onClick={() => { exportChat(); setMenuOpen(false); }}>
                    <IconDownload size={13} /> Export chat
                  </button>
                ) : null}
                <button className="mm-link" onClick={() => { actions.setView('agents'); setMenuOpen(false); }}>
                  <IconBolt size={13} /> Configure team
                </button>
              </div>
            </div>
          ) : null}

          <div className="composer-hint">{auto ? 'auto-routing on — type and it goes to the right team' : 'Enter ↵ send · Shift+Enter newline'}</div>
        </div>
      </div>
      <div className="composer-note">
        {mode === 'image'
          ? img.provider === 'pollinations'
            ? 'Free image generation via Pollinations — no key needed. Click a result to open the editor.'
            : 'DALL·E / GPT-Image via your OpenAI key. Click a result to open the editor.'
          : 'Planner briefs the drafters · reviewer merges · synthesizer ships the final answer'}
      </div>
    </div>
  );
}
