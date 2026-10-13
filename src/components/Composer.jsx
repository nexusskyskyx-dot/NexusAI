import React, { useRef, useState, useEffect } from 'react';
import { useStore, actions, hasCredential } from '../store.js';
import { PROVIDERS, IMAGE_PROVIDERS, modelLabel } from '@shared/providers.js';
import ModelOptions from './ModelPicker.jsx';
import { IMAGE_ASPECTS } from '@lib/images.js';
import { IconSend, IconStop, IconAgents, IconBolt, IconImage, IconChevron, IconDownload, IconSettings } from './Icons.jsx';
import { detectIntent, INTENT_GLYPH } from '@lib/intent.js';

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

  // the effective lane this message will take (mirrors store.generate routing)
  const effLane = !auto
    ? mode
    : intent
    ? intent.mode === 'image'
      ? 'image'
      : intent.mode === 'search' || intent.smalltalk
      ? 'solo'
      : s.settings.mode || 'team'
    : s.settings.mode || 'team';

  // the chip IS the model picker: it names the model that will answer
  const workers = (s.squad.workers || []).filter((w) => w && w.model).length;
  const chipModel =
    effLane === 'image'
      ? (() => {
          const ip = IMAGE_PROVIDERS.find((p) => p.id === img.provider) || IMAGE_PROVIDERS[0];
          return (ip.models.find((m) => m.id === img.model) || ip.models[0] || {}).label || 'Image';
        })()
      : effLane === 'solo'
      ? modelLabel(s.solo.provider, s.solo.model)
      : `Team · ${workers} drafters`;
  const chipGlyph = !auto ? INTENT_GLYPH[mode] : intent ? INTENT_GLYPH[intent.mode] : '🧭';

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
            className={`intent-chip model ${intent ? 'live' : ''}`}
            onClick={() => setMenuOpen(true)}
            title={auto ? `${chipGlyph} auto-routed · answers with ${chipModel} — click to pick models` : `${chipGlyph} ${mode} mode · ${chipModel} — click to pick models`}
          >
            <span className="intent-led" />
            <span className="intent-glyph">{chipGlyph}</span>
            <span className="intent-model">{chipModel}</span>
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
              <div className="mm-models">
                <span className="mm-label">Picks the model that answers{effLane === 'team' ? ' (solo lane · team uses the squad)' : ''}</span>
                <ModelOptions value={s.solo} onChange={(v) => actions.setSolo(v)} />
              </div>
              {effLane === 'image' ? (
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
                      {IMAGE_PROVIDERS.filter((p) => !p.needsKey || hasCredential(p.keyRef || p.id, s)).map((p) =>
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
