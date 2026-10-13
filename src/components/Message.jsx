import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore, actions } from '../store.js';
import { renderMarkdown } from '@lib/markdown.js';
import { previewableLang, extForLang } from '@lib/preview.js';
import { recoverChain, imageModelLabel } from '@lib/images.js';
import { modelLabel, IMAGE_PROVIDERS } from '@shared/providers.js';
import { IconCopy, IconCheck, IconRefresh, IconTrash, IconEdit, IconBrain, IconAgents, IconEye } from './Icons.jsx';
import NexusLoader, { Fold, FoldRow, TEAM_PHASE, IMAGE_PHASE } from './NexusLoader.jsx';

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

  // ── while working: the main loader — hexagon pulsing blue, crossfading text
  if (msg.streaming) {
    const active = phases[phases.length - 1];
    const running = (msg.agents || []).filter((a) => a.status === 'running');
    const detail = running.length
      ? running
          .map((a) => (a.role === 'researcher' ? '🌐 web' : a.provider === 'web' ? '🌐 web' : modelLabel(a.provider, a.model)))
          .slice(0, 4)
          .join(' · ')
      : PHASE_SUB[active];
    return <NexusLoader phase={TEAM_PHASE[active] || 'thinking'} sub={detail} size={34} />;
  }

  // ── after: small folded badges — click to unfold details
  const nDrafters = (msg.agents || []).filter((a) => /draft|worker/i.test(a.role || '')).length;
  const agentText = (role) => {
    const a = (msg.agents || []).find((x) => x.role === role && x.text);
    return a?.text ? a.text.slice(0, 700) : null;
  };
  const secs = msg.ms ? (msg.ms / 1000).toFixed(1) + 's' : null;
  return (
    <FoldRow>
      {phases.includes('research') ? (
        <Fold label={`Searched ${msg.sources?.length || 'the web'}`}>
          {msg.sources?.length ? (
            <div className="fold-links">
              {msg.sources.slice(0, 8).map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer">{s.read ? '📖' : s.source === 'github' ? '⭑' : s.source === 'wikipedia' ? '📚' : '🦆'} {s.title}</a>
              ))}
            </div>
          ) : 'Researched the web for accurate, current knowledge.'}
        </Fold>
      ) : null}
      {phases.includes('plan') ? <Fold label="Planned">{agentText('planner') || 'The planner wrote the brief.'}</Fold> : null}
      {phases.includes('draft') ? (
        <Fold label={`Coded ${nDrafters || 'the'} draft${nDrafters === 1 ? '' : 's'}`}>
          {(msg.agents || []).filter((a) => /draft|worker/i.test(a.role || '')).map((a, i) => (
            <div key={i} className="fold-line">{modelLabel(a.provider, a.model)} — {a.status}</div>
          ))}
        </Fold>
      ) : null}
      {phases.includes('review') ? <Fold label="Reviewed">{agentText('critic') || 'The reviewer compared the drafts.'}</Fold> : null}
      {phases.includes('synthesize') ? <Fold label={`Synthesized${secs ? ' · ' + secs : ''}`}>{agentText('synth') || 'The synthesizer shipped the final answer.'}</Fold> : null}
    </FoldRow>
  );
}

// ── image team: main loader while painting → folded badges after ─────────────
const IMG_ROSTER = 'Websearcher · Enhancer · Image Tools · Upscaler · Previewer';

function ImageLog({ msg }) {
  if (msg.kind !== 'image' || !msg.istages?.length) return null;
  if (msg.streaming) {
    const runs = msg.istages.filter((x) => x.status === 'run');
    const active = runs[runs.length - 1];
    const detail = active?.detail || IMG_ROSTER;
    return <NexusLoader phase={IMAGE_PHASE[active?.stage] || 'drawing'} sub={detail} size={34} />;
  }
  const done = new Set(msg.istages.filter((x) => x.status === 'done').map((x) => x.stage));
  if (!done.size) return null;
  const nImg = msg.images?.length || 0;
  const passCount = (msg.images || []).filter((i) => i.check === 'pass').length;
  const upscaled = (msg.images || []).some((i) => i.upscaled);
  const secs = msg.ms ? (msg.ms / 1000).toFixed(1) + 's' : null;
  return (
    <FoldRow>
      {done.has('research') ? <Fold label="Searched">Researched visual references for the subject.</Fold> : null}
      {done.has('enhance') ? <Fold label="Enhanced">{msg.enhancedPrompt || 'The prompt was rewritten for maximum quality.'}</Fold> : null}
      {done.has('generate') ? <Fold label={`Drew ${nImg} image${nImg === 1 ? '' : 's'}`}>{msg.images?.map((im, i) => (
        <div key={i} className="fold-line">{imageModelLabel(im.model)} · {im.w}×{im.h}{im.upscaled ? ' · sharpened' : ''}{im.fellBack ? ` · stood in for ${String(im.requestedModel || '').split('/').pop()}` : ''}</div>
      ))}</Fold> : null}
      {done.has('upscale') && upscaled ? <Fold label="Sharpened">Unsharp-mask + color grade pass for crisp output.</Fold> : null}
      {done.has('check') ? (
        <Fold label={`Previewed — ${passCount}/${Math.max(nImg, 1)} PASS${secs ? ' · ' + secs : ''}`} tone={passCount === nImg && nImg > 0 ? 'ok' : 'warn'}>
          {(msg.images || []).map((im, i) => (
            <div key={i} className="fold-line">image {i + 1}: {im.check === 'pass' ? '✓ passed the quality gate' : '⚠ failed checks'}</div>
          ))}
          {msg.error ? <div className="fold-line">{msg.error}</div> : null}
        </Fold>
      ) : null}
    </FoldRow>
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

// v1.16.1 · an image that refuses to die: src → durable data → regen URL,
// and only then (after every candidate failed) the expired card.
function ImgCard({ im, onOpen }) {
  const chain = recoverChain(im);
  const [step, setStep] = useState(0);
  const src = chain[step];
  if (!src) {
    return (
      <div className="img-card expired">
        <span className="img-expired">Image unavailable — regenerate</span>
      </div>
    );
  }
  return (
    <button className="img-card" onClick={onOpen} title="Open in viewer / editor">
      <img
        src={src}
        alt={im.prompt || 'generated image'}
        loading="lazy"
        onError={() => setStep((s) => s + 1)}
      />
      <span className="img-cap">
        {im.model} · {im.w}×{im.h}
        {im.upscaled ? ' · sharpened' : ''}
        {im.check === 'pass' ? ' ✓' : im.check === 'fail' ? ' ⚠' : ''}
      </span>
    </button>
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
      {msg.kind !== 'image' && msg.mode !== 'team' && !msg.streaming && msg.ms ? (
        <FoldRow>
          <Fold label={`Thought for ${(msg.ms / 1000).toFixed(1)}s`}>
            {msg.reasoning?.trim() ? <pre className="fold-pre">{msg.reasoning}</pre> : <div className="fold-line">{msg.model || 'the model'} answered directly{msg.sources?.length ? ` · ${msg.sources.length} sources` : ''}.</div>}
          </Fold>
        </FoldRow>
      ) : null}
      <Reasoning text={msg.reasoning} />

      {msg.sources?.length ? (
        <div className="msg-sources">
          <span className="msg-sources-label">🌐 searched the web</span>
          {msg.sources.slice(0, 6).map((src, i) => (
            <a key={i} className="msrc" href={src.url} target="_blank" rel="noreferrer" title={src.title}>
              {src.read ? '📖' : src.source === 'github' ? '⭑' : src.source === 'wikipedia' ? '📚' : '🦆'} {src.title}
            </a>
          ))}
        </div>
      ) : null}

      {msg.kind === 'image' ? (
        <>
          <ImageLog msg={msg} />
          {msg.images?.length ? (
          <div className={`img-grid n${Math.min(msg.images.length, 4)}`}>
            {msg.images.map((im, i) => (
              <ImgCard key={i} im={im} onOpen={() => actions.openStudio(im, msg.id)} />
            ))}
          </div>
        ) : !msg.istages?.length ? (
          <NexusLoader phase="drawing" sub={msg.model} size={34} />
        ) : null}
          {msg.images?.length && !msg.streaming && msg.enhancedPrompt ? (
            <div className="img-enhanced" title={msg.enhancedPrompt}>✨ {msg.enhancedPrompt}</div>
          ) : null}
        </>
      ) : empty && !(msg.mode === 'team' && msg.stages?.length) ? (
        <NexusLoader phase="thinking" sub={msg.mode === 'team' ? PHASE_SUB[lastStage] || 'preparing' : msg.model || null} size={34} />
      ) : (
        <div ref={bodyRef} className={`md ${msg.streaming ? 'streaming' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
      )}

      {msg.error ? <div className="msg-error">⚠ {msg.error}</div> : null}
      {msg.aborted ? <div className="msg-aborted">Stopped by user</div> : null}
    </div>
  );
}
