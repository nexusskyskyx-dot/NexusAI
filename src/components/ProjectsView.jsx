import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, actions } from '../store.js';
import ModelPicker from './ModelPicker.jsx';
import { renderMarkdown } from '@lib/markdown.js';
import { assemblePreview, PROJECT_STAGES, ROLE_META } from '@lib/projects.js';
import { makeZip } from '@lib/zip.js';
import hljs from 'highlight.js/lib/common';
import { IconFolder, IconRocket, IconPlus, IconTrash, IconDownload, IconExternal, IconRefresh, IconCopy, IconCheck, IconTerminal, IconStop, IconSend, IconChat } from './Icons.jsx';

const IDEAS = [
  { title: 'Neon pomodoro timer', sub: 'focus timer with sessions', idea: 'A neon OLED-dark pomodoro timer web app with work/break sessions, a big circular countdown, session counter and keyboard shortcuts.' },
  { title: 'Kanban board', sub: 'drag & drop task columns', idea: 'A Kanban board web app with three columns (To do, Doing, Done), drag-and-drop cards, add/edit/delete tasks and localStorage persistence.' },
  { title: 'Retro snake game', sub: 'arcade classic, canvas-rendered', idea: 'A retro neon snake game on canvas — arrow keys + swipe controls, score, speed levels, game-over screen and a bold OLED-dark arcade look.' },
  { title: 'Markdown notes app', sub: 'live preview, saved locally', idea: 'A markdown notes app: sidebar list of notes, editor with live preview, word count, and localStorage persistence.' },
  { title: 'Quiz game', sub: 'timed questions & scoreboard', idea: 'A timed quiz game with a question bank of 10 questions, multiple choice, score tracking, progress bar and a final results screen.' },
  { title: 'Weather dashboard', sub: 'mock data, animated cards', idea: 'A weather dashboard UI with animated cards for 5 cities (mock data, no API), hourly chart drawn on canvas, and theme toggle.' },
  { title: 'Unit converter', sub: 'sleek instant conversions', idea: 'A unit converter app: length, weight, temperature and data categories with instant conversion as you type and a swap button.' },
  { title: 'Animated portfolio', sub: 'one-page personal site', idea: 'A one-page animated portfolio site: hero with typing effect, projects grid with hover cards, skills bars, and smooth scrolling.' },
  { title: 'Expense tracker', sub: 'charts + localStorage', idea: 'An expense tracker: add expenses with category and date, monthly summary, a category pie chart on canvas, and localStorage persistence.' },
];

const UPGRADE_CHIPS = [
  '✨ Polish the design',
  '📱 Make it mobile friendly',
  '🔊 Add sound effects',
  '🌙 Add a dark/light toggle',
  '⚡ Add animations',
  '🎯 Add a score system',
];

const LANG_BY_EXT = { html: 'xml', htm: 'xml', css: 'css', js: 'javascript', mjs: 'javascript', json: 'json', md: 'markdown', svg: 'xml', txt: 'plaintext' };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function fmtBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function highlightFile(path, code) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  const lang = LANG_BY_EXT[ext];
  try {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {}
  return esc(code);
}

// ── file tree ────────────────────────────────────────────────────────────────
function treeOf(files) {
  const root = { dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (const p of parts.slice(0, -1)) {
      if (!node.dirs.has(p)) node.dirs.set(p, { dirs: new Map(), files: [] });
      node = node.dirs.get(p);
    }
    node.files.push(f);
  }
  return root;
}

function TreeNode({ node, selected, onSelect, depth = 0 }) {
  const dirs = [...node.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const files = [...node.files].sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="ftree-node">
      {dirs.map(([name, child]) => (
        <div key={name} className="ftree-branch">
          <div className="ftree-dir" style={{ paddingLeft: depth * 12 + 10 }}>
            <IconFolder size={13} /> {name}
          </div>
          <TreeNode node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
        </div>
      ))}
      {files.map((f) => (
        <button key={f.path} className={`ftree-file ${selected === f.path ? 'sel' : ''} st-${f.status}`} style={{ paddingLeft: depth * 12 + 10 }} onClick={() => onSelect(f.path)} title={f.path}>
          <span className="ftree-file-name">{f.path.split('/').pop()}{f.touched ? <em className="ftree-v">✨v{f.touched}</em> : null}</span>
          <span className="ftree-file-size">{f.status === 'writing' ? 'writing…' : f.status === 'error' ? 'failed' : fmtBytes(f.bytes)}</span>
        </button>
      ))}
    </div>
  );
}

// ── start screen (before any project exists) ─────────────────────────────────
function StartScreen() {
  const s = useStore();
  const [offset, setOffset] = useState(() => Math.floor(Math.random() * IDEAS.length));
  const [own, setOwn] = useState('');
  const [showOwn, setShowOwn] = useState(false);

  const ideas = [0, 1, 2].map((i) => IDEAS[(offset + i) % IDEAS.length]);
  const start = (idea) => {
    if (s.projectBusy) return;
    actions.startProject(String(idea).trim());
  };

  return (
    <div className="prj-wizard">
      <div className="prj-friend">
        <span className="prj-friend-avatar">👋</span>
        <div>
          <div className="prj-friend-name">Friend</div>
          <p>
            Hey! I'm <b>Friend</b>. Tell the team what to build — the <b>Coordinator</b> plans it, <b>Designer</b> & <b>Coder</b> write the files,
            <b> Tester</b> hunts bugs, the <b>Verifier</b> double-checks them, the <b>Debugger</b> patches what's confirmed, then <b>Documenter</b> and <b>Optimizer</b> ship it.
            You watch everything live in the chat, and afterward you can ask for any upgrade — as many times as you want.
          </p>
        </div>
      </div>

      <div className="prj-ideas-label">Today's ideas</div>
      <div className="prj-ideas">
        {ideas.map((it, i) => (
          <div className="prj-idea" key={i}>
            <div className="prj-idea-title">{it.title}</div>
            <div className="prj-idea-sub">{it.sub}</div>
            <button className="btn btn-acc btn-sm" onClick={() => start(it.idea)} disabled={s.projectBusy}>
              <IconRocket size={13} /> Yes, do that!
            </button>
          </div>
        ))}
      </div>

      <div className="prj-wizard-actions">
        <button className="btn btn-ghost" onClick={() => setOffset((o) => (o + 3) % IDEAS.length)} disabled={s.projectBusy}>
          🎲 Give me more ideas
        </button>
        <button className="btn btn-ghost" onClick={() => setShowOwn((x) => !x)} disabled={s.projectBusy}>
          ✍️ I have my own idea
        </button>
      </div>

      {showOwn && (
        <div className="prj-own">
          <textarea value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Describe your project — what should it do, how should it look…" rows={3} autoFocus />
          <div className="prj-own-row">
            <ModelPicker value={s.prj} onChange={(v) => actions.setPrjModel(v)} />
            <button className="btn btn-acc" onClick={() => own.trim() && start(own)} disabled={!own.trim() || s.projectBusy}>
              <IconRocket size={14} /> Start building
            </button>
          </div>
        </div>
      )}

      {s.projects.length > 0 && (
        <div className="prj-prev">
          <div className="prj-ideas-label">Your projects</div>
          <div className="prj-prev-list">
            {s.projects.map((p) => (
              <button key={p.id} className="prj-prev-item" onClick={() => actions.selectProject(p.id)}>
                <span className="prj-prev-title">{p.title || p.idea?.slice(0, 40) || 'Project'}</span>
                <span className="prj-prev-meta">
                  v{p.version || 1} · {p.files?.length || 0} files
                </span>
                <span
                  className="icon-btn"
                  title="Delete project"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.deleteProject(p.id);
                  }}
                >
                  <IconTrash size={13} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── chat section ─────────────────────────────────────────────────────────────
function ChatMsg({ m }) {
  if (m.kind === 'user') {
    return (
      <div className="pc-msg user">
        <div className="pc-bubble">{m.text}</div>
      </div>
    );
  }
  if (m.kind === 'sys') {
    return <div className="pc-msg sys"><span>{m.text}</span></div>;
  }
  const meta = ROLE_META[m.role] || { glyph: '◆', name: m.role };
  return (
    <div className={`pc-msg agent ${m.error ? 'err' : ''}`}>
      <span className="pc-avatar">{meta.glyph}</span>
      <div className="pc-body">
        <div className="pc-name">
          {meta.name}
          {m.done ? null : (
            <span className="pc-working">
              <span className="led" /> working
            </span>
          )}
        </div>
        <div className="pc-text">{m.text}</div>
        {m.bugs?.length ? (
          <ul className="pc-bugs">
            {m.bugs.map((b, i) => (
              <li key={i}>
                <code>{b.file}{b.line ? ':' + b.line : ''}</code> — {b.issue}
              </li>
            ))}
          </ul>
        ) : null}
        {m.results?.length ? (
          <ul className="pc-results">
            {m.results.map((r, i) => (
              <li key={i} className={r.confirmed ? 'ok' : 'no'}>
                <span className="pc-verdict">{r.confirmed ? '✓ confirmed' : '✕ dismissed'}</span>
                <code>{r.file}{r.line ? ':' + r.line : ''}</code>
                {r.reason ? <em>{r.reason}</em> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {m.md ? <div className="md pc-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.md) }} /> : null}
        {m.tools?.length ? (
          <div className="pc-tools">
            {m.tools.map((t) => (
              <span key={t} className="pc-tool">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatPane({ project, pane }) {
  const s = useStore();
  const [text, setText] = useState('');
  const taRef = useRef(null);
  const scrollRef = useRef(null);
  const files = project.files || [];
  const busy = s.projectBusy && !['done', 'error', 'stopped'].includes(project.status);
  const chat = project.chat || [];

  // autoscroll as the story unfolds
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, chat[chat.length - 1]?.text]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  const placeholder = busy
    ? 'The team is working…'
    : files.length
    ? 'Ask for any change — add a feature, restyle it, fix something…'
    : 'Describe what you want to build…';

  const send = () => {
    const t = text.trim();
    if (!t || s.projectBusy) return;
    setText('');
    if (files.length) actions.upgradeProject(t);
    else actions.startProject(t);
  };

  const running = project.agents?.find((a) => a.status === 'running');
  const writing = files.find((f) => f.status === 'writing');
  const activity = project.upgradeNote || (running ? `${running.name} is working…` : writing ? `Writing ${writing.path}…` : 'Coordinator is planning…');

  return (
    <section className={`pchat ${pane !== 'chat' ? 'pane-off' : ''}`}>
      <div className="pchat-head">
        <IconChat size={14} />
        <span>Project chat</span>
        <span className="pchat-model">{project.model}</span>
      </div>

      <div className="pchat-scroll" ref={scrollRef}>
        {chat.length ? (
          chat.map((m) => <ChatMsg key={m.id} m={m} />)
        ) : (
          <div className="pchat-empty">
            <span className="prj-friend-avatar">👋</span>
            <p>This project was built before team chat existed. Ask for an upgrade below and the whole conversation will appear here.</p>
          </div>
        )}
      </div>

      <footer className="pchat-composer">
        {busy ? (
          <div className="pchat-activity">
            <span className="typing">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span className="pchat-activity-text">{activity}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => actions.stopProject()}>
              Stop
            </button>
          </div>
        ) : (
          files.length > 0 && (
            <div className="pchat-chips">
              {UPGRADE_CHIPS.map((c) => (
                <button key={c} className="pc-chip" onClick={() => actions.upgradeProject(c.replace(/^[^\w]+ /, ''))} disabled={s.projectBusy}>
                  {c}
                </button>
              ))}
            </div>
          )
        )}
        <div className="pchat-row">
          <span className="pchat-picker">
            <ModelPicker value={s.prj} onChange={(v) => actions.setPrjModel(v)} />
          </span>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={placeholder}
            disabled={s.projectBusy}
          />
          {busy ? (
            <button className="btn-send" onClick={() => actions.stopProject()} title="Stop the team" aria-label="Stop the team">
              <IconStop size={15} />
            </button>
          ) : (
            <button className="btn-send" onClick={send} disabled={!text.trim()} title={files.length ? 'Upgrade the project' : 'Start building'} aria-label={files.length ? 'Upgrade the project' : 'Start building'}>
              <IconSend size={15} />
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

// ── thin progress line ───────────────────────────────────────────────────────
function Progress({ project }) {
  const stages = new Set(project.stages || []);
  const map = { planning: 'plan', building: 'build', testing: 'test', verifying: 'verify', debugging: 'debug', retesting: 'retest', documenting: 'docs', reporting: 'report' };
  const activeId = project.status === 'upgrading' ? null : map[project.status];
  const finished = project.status === 'done';
  return (
    <div className="prj-progress">
      {PROJECT_STAGES.map((st, i) => {
        const done = finished || (stages.has(st.id) && activeId !== st.id);
        const active = activeId === st.id;
        return (
          <React.Fragment key={st.id}>
            <div className={`prj-pstep ${done ? 'done' : ''} ${active ? 'active' : ''}`} title={st.desc}>
              <span className="prj-pdot">{done ? '✓' : active ? <span className="led" /> : i + 1}</span>
              <span className="prj-plabel">{st.label}</span>
            </div>
            {i < PROJECT_STAGES.length - 1 && <span className={`prj-plink ${done ? 'on' : ''}`} />}
          </React.Fragment>
        );
      })}
      {project.status === 'upgrading' ? (
        <span className="prj-vup">
          <span className="led" /> upgrading to v{(project.version || 1) + 1}
        </span>
      ) : null}
    </div>
  );
}

// ── agents feed (Team tab) ───────────────────────────────────────────────────
function AgentsList({ agents }) {
  if (!agents?.length) return <div className="prj-pass">No agent has run in this session yet.</div>;
  return (
    <div className="prj-agents">
      {agents.map((a) => (
        <div key={a.id} className={`prj-agent ${a.status}`} title={a.note || a.error || ''}>
          <span className="prj-agent-glyph">{ROLE_META[a.role]?.glyph || '◆'}</span>
          <span className="prj-agent-body">
            <span className="prj-agent-name">
              {a.name}
              {a.note ? <em className="prj-agent-switch">⇄</em> : null}
            </span>
            <span className="prj-agent-model">
              {a.provider}/{a.model}
            </span>
          </span>
          <span className={`prj-agent-status st-${a.status}`}>
            {a.status === 'running' ? <span className="led" /> : null}
            {a.status === 'queued' ? '…' : a.status === 'running' ? 'working' : a.status === 'done' ? `${((a.ms || 0) / 1000).toFixed(1)}s` : 'failed'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── view project section ─────────────────────────────────────────────────────
function ViewPane({ project, pane }) {
  const s = useStore();
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('preview');
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [copied, setCopied] = useState(false);
  const logRef = useRef(null);

  const files = project.files || [];
  const busy = s.projectBusy && !['done', 'error', 'stopped'].includes(project.status);

  // auto-select first file
  useEffect(() => {
    if (!files.length) return;
    if (!selected || !files.some((f) => f.path === selected)) {
      setSelected(files.find((f) => /index\.html?$/i.test(f.path))?.path || files[0].path);
    }
  }, [files, selected]);

  // console messages from the preview iframe
  useEffect(() => {
    const h = (e) => {
      if (e.data && e.data.__nexus) setLogs((l) => [...l.slice(-150), { level: e.data.level, text: e.data.text }]);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const previewKey = files.map((f) => f.path + ':' + f.status + ':' + f.bytes).join('|');
  const srcDoc = useMemo(() => assemblePreview(files), [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const file = files.find((f) => f.path === selected);
  const folderCount = new Set(files.flatMap((f) => f.path.split('/').slice(0, -1))).size;
  const totalBytes = files.reduce((p, c) => p + (c.bytes || 0), 0);

  const downloadZip = () => {
    const blob = makeZip(files.filter((f) => f.content).map((f) => ({ path: f.path, content: f.content })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.title || 'nexusai-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    actions.toast('Project exported as ZIP ✓');
  };

  const openFull = () => {
    window.dispatchEvent(new CustomEvent('nexus-preview', { detail: { code: srcDoc, lang: 'html', title: project.title || 'Project preview' } }));
  };

  const copyFile = async () => {
    if (!file?.content) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const changelog = [...(project.changelog || [])].reverse();
  const tr = project.testReport;

  return (
    <section className={`pview ${pane !== 'view' ? 'pane-off' : ''}`}>
      <header className="pv-head">
        <div className="pv-title">
          <h1>
            {project.title || 'Building…'} <span className={`prj-ver ${project.status === 'upgrading' ? 'up' : ''}`}>v{project.version || 1}</span>
          </h1>
          <p>{project.description || project.idea?.slice(0, 120)}</p>
        </div>
        <div className="pv-actions">
          {busy ? (
            <button className="icon-btn" onClick={() => actions.stopProject()} title="Stop">
              <IconStop size={15} />
            </button>
          ) : (
            <button className="icon-btn" onClick={() => actions.startProject(project.idea)} title="Rebuild from scratch">
              <IconRefresh size={15} />
            </button>
          )}
          <button className="icon-btn" onClick={openFull} disabled={!files.length} title="Fullscreen preview">
            <IconExternal size={15} />
          </button>
          <button className="btn btn-acc btn-sm" onClick={downloadZip} disabled={!files.some((f) => f.content)} title="Download ZIP">
            <IconDownload size={13} /> ZIP
          </button>
          <button className="icon-btn" onClick={() => actions.openProjectWizard()} title="New project">
            <IconPlus size={15} />
          </button>
        </div>
      </header>

      <Progress project={project} />

      <div className="pv-tabs" role="tablist">
        <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          Preview
        </button>
        <button className={tab === 'files' ? 'on' : ''} onClick={() => setTab('files')}>
          Files{files.length ? ` (${files.length})` : ''}
        </button>
        <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>
          Report
        </button>
        <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
          Team
        </button>
      </div>

      <div className="pv-body">
        {tab === 'preview' && (
          <div className="pv-preview">
            <div className="pv-preview-head">
              <span className="led" /> Live
              <span className="pv-preview-note">{files.length ? `${files.length} files assembled` : 'waiting for files…'}</span>
              <button className="icon-btn" onClick={() => setShowConsole((x) => !x)} title="Toggle console">
                <IconTerminal size={13} /> {logs.length ? `(${logs.length})` : ''}
              </button>
            </div>
            <iframe key={previewKey} title="project preview" sandbox="allow-scripts allow-modals allow-forms allow-popups" srcDoc={srcDoc} />
            {showConsole && (
              <div className="prj-console" ref={logRef}>
                {logs.length === 0 && <div className="pconsole-line dim">— console output from the preview appears here —</div>}
                {logs.map((l, i) => (
                  <div key={i} className={`pconsole-line ${l.level}`}>
                    <span className="pconsole-level">{l.level.toUpperCase()}</span> {l.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="pv-files">
            <aside className="pv-tree">
              <div className="pv-tree-head">
                Files
                <span className="pv-tree-meta">
                  {files.length} · {folderCount} folder{folderCount === 1 ? '' : 's'} · {fmtBytes(totalBytes)}
                </span>
              </div>
              <div className="ftree">
                {files.length ? (
                  <TreeNode node={treeOf(files)} selected={selected} onSelect={setSelected} />
                ) : (
                  <div className="ftree-empty">
                    <span className="shimmer" />
                    The Coordinator is planning the file structure…
                  </div>
                )}
              </div>
            </aside>
            <section className="pv-code">
              {file ? (
                <>
                  <div className="pv-code-head">
                    <span className="pv-code-path">{file.path}</span>
                    <span className="pv-code-meta">
                      {file.content ? file.content.split('\n').length : 0} lines · {fmtBytes(file.bytes)}
                      {file.touched ? ' · ✨ v' + file.touched : ''}
                      {file.status === 'patched' ? ' · 🔧 patched' : ''}
                    </span>
                    <button className="icon-btn" onClick={copyFile} title="Copy file">
                      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                    </button>
                  </div>
                  <pre className="pv-code-pre">
                    <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightFile(file.path, file.content || '') }} />
                  </pre>
                </>
              ) : (
                <div className="pv-code-empty">Select a file to view its code.</div>
              )}
            </section>
          </div>
        )}

        {tab === 'report' && (
          <div className="pv-report">
            {changelog.length > 0 && (
              <div className="prj-card">
                <div className="prj-card-head">Upgrades</div>
                {changelog.map((c) => (
                  <div key={c.version} className="prj-chlog">
                    <div className="prj-chlog-head">
                      <span className="prj-chlog-ver">v{c.version}</span>
                      <span className="prj-chlog-req">“{c.request}”</span>
                    </div>
                    <div className="md prj-report" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.summary || '') }} />
                  </div>
                ))}
              </div>
            )}

            {tr ? (
              <div className="prj-card">
                <div className="prj-card-head">Test report</div>
                {tr.bugs?.length ? (
                  <>
                    <ul className="prj-bugs">
                      {tr.bugs.map((b, i) => (
                        <li key={i} className={b.confirmed === false ? 'dismissed' : ''}>
                          <b>{b.file}{b.line ? ':' + b.line : ''}</b> — {b.issue}
                          {b.confirmed === false ? <span className="prj-bug-fix">→ false alarm ({b.reason || 'dismissed by Verifier'})</span> : b.fix ? <span className="prj-bug-fix">→ {b.fix}</span> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="prj-verdicts">
                      {tr.confirmed != null ? <span>🔬 Verifier confirmed {tr.confirmed}</span> : null}
                      {tr.dismissed ? <span>· dismissed {tr.dismissed}</span> : null}
                      {tr.applied ? <span>· 🔧 patched {tr.applied}</span> : null}
                      {tr.retest === 'pass' ? <span>· ✅ re-test passed</span> : null}
                    </div>
                  </>
                ) : (
                  <div className="prj-pass">✓ All checks passed — no bugs found.</div>
                )}
              </div>
            ) : null}

            {project.report ? (
              <div className="prj-card">
                <div className="prj-card-head">Final report</div>
                <div className="md prj-report" dangerouslySetInnerHTML={{ __html: renderMarkdown(project.report) }} />
              </div>
            ) : !changelog.length ? (
              <div className="prj-pass">The report appears here when the team finishes.</div>
            ) : null}

            {project.error ? <div className="msg-error">⚠ {project.error}</div> : null}
            {project.status === 'stopped' ? <div className="msg-aborted">Stopped by user</div> : null}
          </div>
        )}

        {tab === 'team' && (
          <div className="pv-team">
            <div className="pv-roster">
              {Object.entries(ROLE_META).map(([id, r]) => (
                <div key={id} className="pv-member">
                  <span className="pv-member-glyph">{r.glyph}</span>
                  <div className="pv-member-body">
                    <div className="pv-member-name">{r.name}</div>
                    <div className="pv-member-job">{r.job}</div>
                    <div className="pv-member-tools">
                      {r.tools.map((t) => (
                        <span key={t} className="pc-tool">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="prj-card">
              <div className="prj-card-head">This session</div>
              <AgentsList agents={project.agents} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── the room: CHAT (left) + VIEW PROJECT (right) ─────────────────────────────
function ProjectRoom({ project }) {
  const [pane, setPane] = useState('chat');
  return (
    <div className="prj-room">
      <ChatPane project={project} pane={pane} />
      <ViewPane project={project} pane={pane} />
      <div className="prj-panes">
        <button className={pane === 'chat' ? 'on' : ''} onClick={() => setPane('chat')}>
          <IconChat size={13} /> Chat
        </button>
        <button className={pane === 'view' ? 'on' : ''} onClick={() => setPane('view')}>
          View project
        </button>
      </div>
    </div>
  );
}

export default function ProjectsView() {
  const s = useStore();
  const project = s.projects.find((p) => p.id === s.activeProjectId);
  return (
    <div className="page projectsview">
      {project ? <ProjectRoom project={project} /> : <StartScreen />}
    </div>
  );
}
