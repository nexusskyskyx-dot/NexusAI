import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, actions } from '../store.js';
import ModelPicker from './ModelPicker.jsx';
import { renderMarkdown } from '@lib/markdown.js';
import { assemblePreview, PROJECT_STAGES, ROLE_META } from '@lib/projects.js';
import { makeZip } from '@lib/zip.js';
import hljs from 'highlight.js/lib/common';
import { IconFolder, IconRocket, IconPlus, IconTrash, IconDownload, IconExternal, IconRefresh, IconCopy, IconCheck, IconTerminal, IconStop } from './Icons.jsx';

const IDEAS = [
  { title: 'Neon pomodoro timer', sub: 'focus timer with sessions & sounds', idea: 'A neon OLED-dark pomodoro timer web app with work/break sessions, a big circular countdown, session counter and keyboard shortcuts.' },
  { title: 'Kanban board', sub: 'drag & drop task columns', idea: 'A Kanban board web app with three columns (To do, Doing, Done), drag-and-drop cards, add/edit/delete tasks and localStorage persistence.' },
  { title: 'Retro snake game', sub: 'arcade classic, canvas-rendered', idea: 'A retro neon snake game on canvas — arrow keys + swipe controls, score, speed levels, game-over screen and a bold OLED-dark arcade look.' },
  { title: 'Markdown notes app', sub: 'live preview, saved locally', idea: 'A markdown notes app: sidebar list of notes, editor with live preview, word count, and localStorage persistence.' },
  { title: 'Quiz game', sub: 'timed questions & scoreboard', idea: 'A timed quiz game with a question bank of 10 questions, multiple choice, score tracking, progress bar and a final results screen.' },
  { title: 'Weather dashboard', sub: 'mock data, animated cards', idea: 'A weather dashboard UI with animated cards for 5 cities (mock data, no API), hourly chart drawn on canvas, and theme toggle.' },
  { title: 'Unit converter', sub: 'sleek instant conversions', idea: 'A unit converter app: length, weight, temperature and data categories with instant conversion as you type and a swap button.' },
  { title: 'Animated portfolio', sub: 'one-page personal site', idea: 'A one-page animated portfolio site: hero with typing effect, projects grid with hover cards, skills bars, and smooth scrolling.' },
  { title: 'Expense tracker', sub: 'charts + localStorage', idea: 'An expense tracker: add expenses with category and date, monthly summary, a category pie chart on canvas, and localStorage persistence.' },
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
            <span className="ftree-count">{child.files.length + [...child.dirs.values()].reduce((p, c) => p + c.files.length, 0)}</span>
          </div>
          <TreeNode node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
        </div>
      ))}
      {files.map((f) => (
        <button key={f.path} className={`ftree-file ${selected === f.path ? 'sel' : ''} st-${f.status}`} style={{ paddingLeft: depth * 12 + 10 }} onClick={() => onSelect(f.path)} title={f.path}>
          <span className="ftree-file-name">{f.path.split('/').pop()}</span>
          <span className="ftree-file-size">{f.status === 'writing' ? 'writing…' : f.status === 'error' ? 'failed' : fmtBytes(f.bytes)}</span>
        </button>
      ))}
    </div>
  );
}

// ── wizard (the FRIEND) ──────────────────────────────────────────────────────
function Wizard() {
  const s = useStore();
  const [offset, setOffset] = useState(() => Math.floor(Math.random() * IDEAS.length));
  const [own, setOwn] = useState('');
  const [showOwn, setShowOwn] = useState(false);

  const ideas = [0, 1, 2].map((i) => IDEAS[(offset + i) % IDEAS.length]);
  const more = () => setOffset((o) => (o + 3) % IDEAS.length);
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
            Hey! I'm <b>Friend</b>, your project sidekick. Tell the team what to build — a Coordinator will plan it, then a Designer, Coder,
            Tester, Debugger, Documenter and Optimizer will deliver it, live.
          </p>
        </div>
      </div>

      <div className="prj-ideas-label">💡 Today's ideas</div>
      <div className="prj-ideas">
        {ideas.map((it, i) => (
          <div className="prj-idea" key={i}>
            <div className="prj-idea-title">{it.title}</div>
            <div className="prj-idea-sub">{it.sub}</div>
            <div className="prj-idea-actions">
              <button className="btn btn-acc btn-sm" onClick={() => start(it.idea)} disabled={s.projectBusy}>
                <IconRocket size={13} /> Yes, do that!
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="prj-wizard-actions">
        <button className="btn btn-ghost" onClick={more} disabled={s.projectBusy}>
          🎲 Give me more ideas
        </button>
        <button className="btn btn-ghost" onClick={() => setShowOwn((x) => !x)} disabled={s.projectBusy}>
          ✍️ I have my own idea
        </button>
      </div>

      {showOwn && (
        <div className="prj-own">
          <textarea
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder="Describe your project — what should it do, how should it look…"
            rows={3}
            autoFocus
          />
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
          <div className="prj-ideas-label">🗂 Your projects</div>
          <div className="prj-prev-list">
            {s.projects.map((p) => (
              <button key={p.id} className="prj-prev-item" onClick={() => actions.selectProject(p.id)}>
                <span className="prj-prev-title">{p.title || p.idea?.slice(0, 40) || 'Project'}</span>
                <span className="prj-prev-meta">
                  {p.files?.length || 0} files · {p.status}
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

// ── project room ─────────────────────────────────────────────────────────────
function Stepper({ project }) {
  const stages = new Set(project.stages || []);
  const map = { planning: 'plan', building: 'build', testing: 'test', debugging: 'debug', documenting: 'docs', reporting: 'report' };
  const activeId = map[project.status];
  return (
    <div className="prj-stepper">
      {PROJECT_STAGES.map((st, i) => {
        const done = stages.has(st.id) && !(activeId === st.id && project.status !== 'done');
        const active = activeId === st.id && project.status !== 'done';
        return (
          <React.Fragment key={st.id}>
            <div className={`prj-step ${done || project.status === 'done' ? 'done' : ''} ${active ? 'active' : ''}`} title={st.desc}>
              <span className="prj-step-glyph">{st.glyph}</span>
              <span className="prj-step-label">{st.label}</span>
            </div>
            {i < PROJECT_STAGES.length - 1 && <span className={`prj-step-link ${(done || project.status === 'done') ? 'on' : ''}`}>─</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AgentsStrip({ agents }) {
  if (!agents?.length) return null;
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

function ProjectRoom({ project }) {
  const s = useStore();
  const [selected, setSelected] = useState(null);
  const [pane, setPane] = useState('preview'); // mobile tabs: files | code | preview
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [copied, setCopied] = useState(false);
  const logRef = useRef(null);

  const files = project.files || [];
  const busy = s.projectBusy && project.status !== 'done' && project.status !== 'error' && project.status !== 'stopped';

  // auto-select the first file
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

  // preview refreshes whenever a file finishes or gets patched
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

  return (
    <div className="prj-room">
      <header className="prj-head">
        <div className="prj-head-title">
          <h1>{project.title || 'Building…'}</h1>
          <p>{project.description || project.idea?.slice(0, 120)}</p>
        </div>
        <div className="prj-head-actions">
          {busy ? (
            <button className="btn btn-ghost btn-sm" onClick={() => actions.stopProject()}>
              <IconStop size={13} /> Stop
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => actions.startProject(project.idea)} title="Build again with the current model">
              <IconRefresh size={13} /> Rebuild
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={openFull} disabled={!files.length}>
            <IconExternal size={13} /> Full preview
          </button>
          <button className="btn btn-acc btn-sm" onClick={downloadZip} disabled={!files.some((f) => f.content)}>
            <IconDownload size={13} /> ZIP
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => actions.openProjectWizard()}>
            <IconPlus size={13} /> New
          </button>
        </div>
      </header>

      <Stepper project={project} />

      <div className="prj-body">
        {/* explorer */}
        <aside className={`prj-explorer ${pane !== 'files' ? 'pane-off' : ''}`}>
          <div className="prj-explorer-head">
            <span>Files</span>
            <span className="prj-explorer-meta">
              {files.length} files · {folderCount} folder{folderCount === 1 ? '' : 's'} · {fmtBytes(totalBytes)}
            </span>
          </div>
          <div className="ftree">
            {files.length ? (
              <TreeNode node={treeOf(files)} selected={selected} onSelect={(p) => { setSelected(p); setPane('code'); }} />
            ) : (
              <div className="ftree-empty">
                <span className="shimmer" />
                The Coordinator is planning the file structure…
              </div>
            )}
          </div>
        </aside>

        {/* code viewer */}
        <section className={`prj-code ${pane !== 'code' ? 'pane-off' : ''}`}>
          {file ? (
            <>
              <div className="prj-code-head">
                <span className="prj-code-path">{file.path}</span>
                <span className="prj-code-meta">
                  {file.by} · {file.content ? file.content.split('\n').length : 0} lines · {fmtBytes(file.bytes)}
                  {file.status === 'patched' ? ' · 🔧 patched' : ''}
                </span>
                <button className="icon-btn" onClick={copyFile} title="Copy file">
                  {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                </button>
              </div>
              <pre className="prj-code-pre">
                <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightFile(file.path, file.content || '') }} />
              </pre>
            </>
          ) : (
            <div className="prj-code-empty">Select a file to view its code.</div>
          )}
        </section>

        {/* preview + agents + reports */}
        <section className={`prj-side ${pane !== 'preview' ? 'pane-off' : ''}`}>
          <div className="prj-preview">
            <div className="prj-preview-head">
              <span className="led" /> Live preview
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

          <AgentsStrip agents={project.agents} />

          {project.testReport ? (
            <div className="prj-card">
              <div className="prj-card-head">🧪 Test report</div>
              {project.testReport.bugs?.length ? (
                <>
                  <ul className="prj-bugs">
                    {project.testReport.bugs.map((b, i) => (
                      <li key={i}>
                        <b>{b.file}</b> — {b.issue}
                        {b.fix ? <span className="prj-bug-fix">→ {b.fix}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {project.testReport.applied ? (
                    <div className="prj-bugs-applied">🔧 Debugger patched {project.testReport.applied} file{project.testReport.applied > 1 ? 's' : ''}</div>
                  ) : (
                    <div className="prj-bugs-pending">🔧 Debugger is on it…</div>
                  )}
                </>
              ) : (
                <div className="prj-pass">✓ All checks passed — no bugs found.</div>
              )}
            </div>
          ) : null}

          {project.report ? (
            <div className="prj-card">
              <div className="prj-card-head">📊 Final report</div>
              <div className="md prj-report" dangerouslySetInnerHTML={{ __html: renderMarkdown(project.report) }} />
            </div>
          ) : null}

          {project.error ? <div className="msg-error">⚠ {project.error}</div> : null}
          {project.status === 'stopped' ? <div className="msg-aborted">Stopped by user</div> : null}
        </section>
      </div>

      {/* mobile pane switch */}
      <div className="prj-panes">
        {['files', 'code', 'preview'].map((p) => (
          <button key={p} className={pane === p ? 'on' : ''} onClick={() => setPane(p)}>
            {p === 'files' ? `Files (${files.length})` : p === 'code' ? 'Code' : 'Preview'}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsView() {
  const s = useStore();
  const project = s.projects.find((p) => p.id === s.activeProjectId);
  return <div className="page projectsview">{project ? <ProjectRoom project={project} /> : <Wizard />}</div>;
}
