import React, { useState } from 'react';
import { useStore, actions } from '../store.js';
import { IconX, IconChevron, IconBolt, IconAgents, IconBrain } from './Icons.jsx';

const STAGES = [
  { id: 'plan', label: 'PLAN', desc: 'Planner writes the brief' },
  { id: 'draft', label: 'DRAFT', desc: 'Models answer in parallel' },
  { id: 'review', label: 'REVIEW', desc: 'Reviewer compares drafts' },
  { id: 'synthesize', label: 'SYNTH', desc: 'Final answer assembled' },
];

const ROLE_GLYPH = { planner: '⌘', worker: '◆', critic: '☰', synth: '★' };

function AgentCard({ a }) {
  const [open, setOpen] = useState(false);
  const hasText = !!a.text?.trim();
  return (
    <div className={`agent-card ${a.status} ${a.role}`}>
      <div className="agent-head" onClick={() => hasText && setOpen((o) => !o)}>
        <span className="agent-glyph">{ROLE_GLYPH[a.role] || '◆'}</span>
        <div className="agent-id">
          <span className="agent-name">{a.name}</span>
          <span className="agent-model">
            {a.provider}/{a.model}
          </span>
        </div>
        <span className={`agent-status st-${a.status}`}>
          {a.status === 'running' ? <span className="led" /> : null}
          {a.status === 'queued' ? 'QUEUED' : a.status === 'running' ? 'WORKING' : a.status === 'done' ? `${((a.ms || 0) / 1000).toFixed(1)}s ✓` : 'FAILED'}
        </span>
        {hasText ? <span className="agent-caret">{open ? '▾' : '▸'}</span> : null}
      </div>
      {a.error ? <div className="agent-error">⚠ {a.error}</div> : null}
      {a.reasoning?.trim() && open ? (
        <div className="agent-reasoning">
          <IconBrain size={12} /> reasoning: {a.reasoning.length.toLocaleString()} chars
        </div>
      ) : null}
      {hasText && open ? (
        <pre className="agent-body">{a.text}</pre>
      ) : hasText && a.status === 'running' ? (
        <div className="agent-live">
          {a.text.slice(-220).replace(/[#*`>]/g, '')}
          <span className="caret">▍</span>
        </div>
      ) : null}
    </div>
  );
}

export default function AgentsPanel() {
  const s = useStore();
  const conv = s.conversations.find((c) => c.id === s.activeId);
  const msg =
    (s.streamMsg && conv?.messages.find((m) => m.id === s.streamMsg.msgId)) ||
    [...(conv?.messages || [])].reverse().find((m) => m.mode === 'team' && (m.agents?.length || m.streaming));

  if (!s.agentsOpen) return null;

  const reached = new Set((msg?.stages || []).map((x) => x.stage));
  const done = msg && !msg.streaming;
  const agents = msg?.agents || [];

  return (
    <div className="agents-panel">
      <div className="agents-panel-head">
        <IconAgents size={16} />
        <span>AGENT PIPELINE</span>
        {done ? <span className="agents-panel-done">COMPLETE</span> : <span className="agents-panel-live"><span className="led" /> LIVE</span>}
        <button className="icon-btn" onClick={() => actions.setAgentsOpen(false)}>
          <IconX size={15} />
        </button>
      </div>

      <div className="stagebar">
        {STAGES.map((st, i) => (
          <React.Fragment key={st.id}>
            <div className={`stage ${reached.has(st.id) ? 'hit' : ''} ${done && i === STAGES.length - 1 ? 'hit' : ''}`}>
              <span className="stage-name">{st.label}</span>
              <span className="stage-desc">{st.desc}</span>
            </div>
            {i < STAGES.length - 1 ? <span className={`stage-link ${reached.has(STAGES[i + 1].id) ? 'hit' : ''}`}>──▶</span> : null}
          </React.Fragment>
        ))}
      </div>

      {agents.length === 0 ? (
        <div className="agents-empty">
          <IconBolt size={18} />
          <p>No pipeline yet. Send a message in <b>TEAM</b> mode and the agents will appear here in real time.</p>
        </div>
      ) : (
        <div className="agents-list">
          {agents.map((a) => (
            <AgentCard key={a.id} a={a} />
          ))}
        </div>
      )}

      {msg?.verdict ? (
        <div className="verdict">
          ★ REVIEWER PICKED <b>DRAFT {msg.verdict}</b>
        </div>
      ) : null}
    </div>
  );
}
