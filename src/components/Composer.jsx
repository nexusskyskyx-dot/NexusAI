import React, { useRef, useState, useEffect } from 'react';
import { useStore, actions } from '../store.js';
import ModelPicker from './ModelPicker.jsx';
import { IconSend, IconStop, IconAgents, IconBolt } from './Icons.jsx';

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

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="composer-top">
          <div className="mode-switch" role="tablist">
            <button className={`mode-btn ${mode === 'solo' ? 'on' : ''}`} onClick={() => actions.setSettings({ mode: 'solo' })} title="One model answers directly">
              <IconBolt size={13} /> SOLO
            </button>
            <button className={`mode-btn ${mode === 'team' ? 'on' : ''}`} onClick={() => actions.setSettings({ mode: 'team' })} title="Planner → Drafters → Reviewer → Synthesizer">
              <IconAgents size={13} /> TEAM
            </button>
          </div>

          {mode === 'solo' ? (
            <ModelPicker value={s.solo} onChange={(v) => actions.setSolo(v)} />
          ) : (
            <button className="model-chip team-chip" onClick={() => actions.setView('agents')} title="Configure the agent squad">
              <span className="model-chip-dot" />
              {(s.squad.workers || []).filter((w) => w && w.model).length} DRAFTERS + REVIEW
              <span className="model-chip-sep">·</span>
              CONFIGURE
            </button>
          )}

          <div className="composer-hint">ENTER ⏎ SEND · SHIFT+ENTER NEWLINE</div>
        </div>

        <div className="composer-main">
          <textarea
            ref={taRef}
            value={text}
            placeholder={mode === 'team' ? 'Brief the team — the agents will collaborate on the best answer…' : 'Ask NexusAI anything…'}
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
            <button className="btn btn-stop" onClick={() => actions.stopGeneration()} title="Stop generation">
              <IconStop size={16} />
            </button>
          ) : (
            <button className="btn btn-send" onClick={send} disabled={!text.trim()} title="Send">
              <IconSend size={17} />
            </button>
          )}
        </div>
      </div>
      <div className="composer-note">
        {mode === 'team'
          ? 'TEAM MODE — Planner writes a brief, drafters compete in parallel, the reviewer merges, the synthesizer ships the final answer.'
          : 'SOLO MODE — the selected model answers directly, streamed.'}
      </div>
    </div>
  );
}
