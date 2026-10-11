import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore, actions } from '../store.js';
import { renderMarkdown } from '@lib/markdown.js';
import { previewableLang, extForLang } from '@lib/preview.js';
import { IconCopy, IconCheck, IconRefresh, IconTrash, IconEdit, IconBrain, IconAgents, IconEye } from './Icons.jsx';

const STAGE_LABELS = {
  plan: 'Planning the approach',
  draft: 'Drafting in parallel',
  review: 'Reviewing the drafts',
  synthesize: 'Synthesizing the final answer',
  done: 'Finishing up',
};

// Attach interactive toolbars to rendered <pre><code> blocks
function enhanceCodeBlocks(root) {
  if (!root) return;
  const pres = root.querySelectorAll('pre');
  pres.forEach((pre) => {
    if (pre.dataset.nx) return;
    pre.dataset.nx = '1';
    const code = pre.querySelector('code');
    if (!code) return;
    const lang = (Array.from(code.classList).find((c) => c.startsWith('language-')) || '').replace('language-', '') || 'text';
    const raw = code.textContent || '';

    const bar = document.createElement('div');
    bar.className = 'codebar';
    const name = document.createElement('span');
    name.className = 'codebar-lang';
    name.textContent = lang;
    bar.appendChild(name);

    const mkBtn = (label, title, onClick, cls = '') => {
      const b = document.createElement('button');
      b.className = 'codebar-btn ' + cls;
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', onClick);
      bar.appendChild(b);
      return b;
    };

    mkBtn('Copy', 'Copy code', async (e) => {
      try {
        await navigator.clipboard.writeText(raw);
        e.currentTarget.textContent = 'Copied ✓';
        setTimeout(() => (e.currentTarget.textContent = 'Copy'), 1400);
      } catch {}
    });

    mkBtn('Save', 'Download file', () => {
      const blob = new Blob([raw], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nexusai-snippet.${extForLang(lang)}`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    if (previewableLang(lang)) {
      mkBtn('Preview', 'Live preview', () => {
        window.dispatchEvent(new CustomEvent('nexus-preview', { detail: { code: raw, lang, title: `Preview · ${lang}` } }));
      }, 'acc');
    }

    pre.prepend(bar);
  });
}

function Reasoning({ text }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;
  return (
    <div className="reasoning">
      <button className="reasoning-head" onClick={() => setOpen((o) => !o)}>
        <IconBrain size={14} />
        <span>Thought process</span>
        <span className="reasoning-len">{text.length.toLocaleString()} chars</span>
        <span className="reasoning-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && <pre className="reasoning-body">{text}</pre>}
    </div>
  );
}

function TeamBadge({ msg }) {
  const agents = msg.agents || [];
  const ok = agents.filter((a) => a.status === 'done');
  const failed = agents.filter((a) => a.status === 'error');
  if (!agents.length) return null;
  return (
    <div className="team-trace">
      <button className="team-trace-btn" onClick={() => actions.setAgentsOpen(true)} title="Open agent pipeline">
        <IconAgents size={13} />
        <span>Agent pipeline</span>
        <span className="team-trace-count">
          {ok.length} ok{failed.length ? ` · ${failed.length} failed` : ''}
        </span>
      </button>
      <div className="team-models">
        {agents.map((a) => (
          <span key={a.id} className={`team-model ${a.status === 'error' ? 'err' : a.status === 'running' ? 'run' : ''}`}>
            {a.role === 'planner' ? '⌘ ' : a.role === 'critic' ? '☰ ' : a.role === 'synth' ? '★ ' : '◆ '}
            {a.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {}
    },
  ];
}

export default function Message({ msg, isLast }) {
  const s = useStore();
  const bodyRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [copied, copy] = useCopy();

  const html = useMemo(() => renderMarkdown(msg.content || '', { highlight: !msg.streaming }), [msg.content, msg.streaming]);

  useEffect(() => {
    enhanceCodeBlocks(bodyRef.current);
  }, [msg.content, msg.streaming]);

  if (msg.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-user-card">
          {editing ? (
            <div className="msg-edit">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} autoFocus />
              <div className="msg-edit-actions">
                <button
                  className="btn btn-acc btn-sm"
                  onClick={() => {
                    setEditing(false);
                    if (editText.trim()) actions.editUserMessage(msg.id, editText);
                  }}
                >
                  Save & rerun
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="msg-user-text">{msg.content}</div>
              <div className="msg-user-actions">
                <button
                  className="icon-btn"
                  title="Edit & resend"
                  onClick={() => {
                    setEditing(true);
                    setEditText(msg.content);
                  }}
                >
                  <IconEdit size={13} />
                </button>
                <button className="icon-btn" title="Delete" onClick={() => actions.deleteMessage(msg.id)}>
                  <IconTrash size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // assistant
  const empty = !msg.content && msg.streaming;
  const lastStage = msg.stages?.length ? msg.stages[msg.stages.length - 1].stage : null;

  return (
    <div className="msg msg-ai">
      <div className="msg-ai-head">
        <span className="msg-ai-brand">⬡ NEXUSAI</span>
        {msg.mode === 'team' ? <span className="msg-ai-mode">Team</span> : null}
        {msg.model && <span className="msg-ai-model">{msg.model}</span>}
        {msg.streaming ? (
          <span className="typing">
            <i></i>
            <i></i>
            <i></i>
          </span>
        ) : null}
        {!msg.streaming && msg.ms ? <span className="msg-ai-meta">{(msg.ms / 1000).toFixed(1)}s</span> : null}
        {!msg.streaming && msg.content ? (
          <span className="msg-ai-actions">
            <button className="icon-btn" title="Copy answer" onClick={() => copy(msg.content)}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </button>
            {isLast && !s.streaming ? (
              <button className="icon-btn" title="Regenerate" onClick={() => actions.regenerate(msg.id)}>
                <IconRefresh size={13} />
              </button>
            ) : null}
            <button className="icon-btn" title="Delete" onClick={() => actions.deleteMessage(msg.id)}>
              <IconTrash size={13} />
            </button>
          </span>
        ) : null}
      </div>

      <TeamBadge msg={msg} />
      <Reasoning text={msg.reasoning} />

      {empty ? (
        <div className="msg-ai-wait">
          <span className="shimmer" />
          <span className="wait-label">
            {msg.mode === 'team' ? STAGE_LABELS[lastStage] || 'Assembling the team' : 'Thinking'}
            <span className="wait-dots">…</span>
          </span>
          {msg.mode === 'team' ? <span className="wait-sub">Follow the agents in the pipeline panel</span> : null}
        </div>
      ) : (
        <div ref={bodyRef} className={`md ${msg.streaming ? 'streaming' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {msg.error ? <div className="msg-error">⚠ {msg.error}</div> : null}
      {msg.aborted ? <div className="msg-aborted">Stopped by user</div> : null}
    </div>
  );
}
