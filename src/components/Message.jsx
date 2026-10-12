import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore, actions } from '../store.js';
import { renderMarkdown } from '@lib/markdown.js';
import { previewableLang, extForLang } from '@lib/preview.js';
import { modelLabel } from '@shared/providers.js';
import { IconCopy, IconCheck, IconRefresh, IconTrash, IconEdit, IconBrain, IconAgents, IconEye } from './Icons.jsx';

// ── work phases: what the team is doing right now ─────────────────────────────
// while working: title + what item is being handled → after: collapsed ✓ titles
const PHASE_DONE = { research: 'Researched', plan: 'Planned', draft: 'Drafted', review: 'Reviewed', synthesize: 'Synthesized' };
const PHASE_NOW = { research: 'Researching', plan: 'Thinking', draft: 'Coding', review: 'Reviewing', synthesize: 'Composing' };
const PHASE_SUB = {
  research: 'searching the web',
  plan: 'writing the brief',
  draft: 'drafting answers in parallel',
  review: 'comparing the drafts',
  synthesize: 'assembling the final answer',
};

function WorkLog({ msg }) {
  if (msg.mode !== 'team' || !msg.stages?.length) return null;
  const phases = msg.stages.map((x) => x.stage).filter((x) => x !== 'done' && PHASE_DONE[x]);
  if (!phases.length) return null;

  if (msg.streaming) {
    const active = phases[phases.length - 1];
    const running = (msg.agents || []).filter((a) => a.status === 'running');
    const detail = running.length
      ? running
          .map((a) => (a.role === 'researcher' ? '🌐 web' : a.provider === 'web' ? '🌐 web' : modelLabel(a.provider, a.model)))
          .slice(0, 4)
          .join(' · ')
      : PHASE_SUB[active];
    return (
      <div className="worklog">
        {phases.slice(0, -1).map((st) => (
          <div key={st} className="wstep done">
            ✓ {PHASE_DONE[st]}
          </div>
        ))}
        <div className="wstep active">
          <span className="wstep-title">
            <span className="led" /> {PHASE_NOW[active]}…
          </span>
          <span className="wstep-sub">{detail}</span>
        </div>
      </div>
    );
  }

  // finished → one collapsed line of completed titles
  return (
    <button className="worksum" onClick={() => actions.setAgentsOpen(true)} title="Open the agent pipeline">
      <IconAgents size={12} />
      {phases.map((st) => `✓ ${PHASE_DONE[st]}`).join(' · ')}
      {msg.ms ? <span className="worksum-ms">{(msg.ms / 1000).toFixed(1)}s</span> : null}
    </button>
  );
}

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
      {!msg.streaming && msg.content ? (
        <span className="msg-ai-float">
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

      <WorkLog msg={msg} />
      <Reasoning text={msg.reasoning} />

      {msg.sources?.length ? (
        <div className="msg-sources">
          <span className="msg-sources-label">🌐 searched the web</span>
          {msg.sources.slice(0, 6).map((src, i) => (
            <a key={i} className="msrc" href={src.url} target="_blank" rel="noreferrer" title={src.title}>
              {src.source === 'github' ? '⭑' : src.source === 'wikipedia' ? '📚' : '🦆'} {src.title}
            </a>
          ))}
        </div>
      ) : null}

      {msg.kind === 'image' ? (
        msg.images?.length ? (
          <div className={`img-grid n${Math.min(msg.images.length, 4)}`}>
            {msg.images.map((im, i) =>
              im.src ? (
                <button key={i} className="img-card" onClick={() => actions.openStudio(im, msg.id)} title="Open in viewer / editor">
                  <img src={im.src} alt={im.prompt || 'generated image'} loading="lazy" />
                  <span className="img-cap">
                    {im.model} · {im.w}×{im.h}
                  </span>
                </button>
              ) : (
                <div key={i} className="img-card expired">
                  <span className="img-expired">Image expired — regenerate</span>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="msg-ai-wait">
            <span className="shimmer" />
            <span className="wait-label">
              Painting your image<span className="wait-dots">…</span>
            </span>
            <span className="wait-sub">{msg.model}</span>
          </div>
        )
      ) : empty && !(msg.mode === 'team' && msg.stages?.length) ? (
        <div className="msg-ai-wait">
          <span className="shimmer" />
          <span className="wait-label">
            {msg.mode === 'team' ? PHASE_NOW[lastStage] || 'Thinking' : 'Thinking'}
            <span className="wait-dots">…</span>
          </span>
          <span className="wait-sub">{msg.mode === 'team' ? PHASE_SUB[lastStage] || 'preparing' : ''}</span>
        </div>
      ) : (
        <div ref={bodyRef} className={`md ${msg.streaming ? 'streaming' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {msg.error ? <div className="msg-error">⚠ {msg.error}</div> : null}
      {msg.aborted ? <div className="msg-aborted">Stopped by user</div> : null}
    </div>
  );
}
