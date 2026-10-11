import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore, actions } from '../store.js';
import { buildDoc } from '@lib/preview.js';
import { IconCode, IconPlay, IconExternal, IconDownload, IconTerminal, IconBolt } from './Icons.jsx';

const DEFAULT_FILES = {
  'index.html': `<div class="hero">
  <h1>NEXUS <span>CANVAS</span></h1>
  <p>Edit the code — the preview updates live.</p>
  <button id="go">CLICK ME</button>
  <p id="out"></p>
</div>`,
  'style.css': `* { box-sizing: border-box; }
body { background: #000; color: #f2f2f2; font-family: system-ui, sans-serif; font-weight: 700; display: grid; place-items: center; min-height: 92vh; margin: 0; }
.hero { text-align: center; border: 1px solid #1f1f1f; border-radius: 20px; padding: 56px 48px; background: #060606; }
h1 { font-size: 64px; letter-spacing: -0.03em; margin: 0; }
h1 span { color: var(--nx, #00ff9c); text-shadow: 0 0 28px rgba(0,255,156,.5); }
p { color: #9a9a9a; }
button { background: #00ff9c; border: 0; color: #000; font-weight: 800; padding: 14px 32px; border-radius: 999px; cursor: pointer; font-size: 15px; }
button:hover { box-shadow: 0 0 26px rgba(0,255,156,.55); }`,
  'app.js': `let n = 0;
document.getElementById('go').addEventListener('click', () => {
  n++;
  console.log('clicked', n);
  document.getElementById('out').textContent = n + ' click' + (n > 1 ? 's' : '') + ' — hello from app.js';
});`,
};

const LS_KEY = 'nexus.canvas.v1';

function loadFiles() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return { ...DEFAULT_FILES };
}

export default function CanvasView() {
  const s = useStore();
  const [files, setFiles] = useState(loadFiles);
  const [active, setActive] = useState('index.html');
  const [nonce, setNonce] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(true);
  const [auto, setAuto] = useState(true);
  const [pane, setPane] = useState('code'); // mobile pane switch
  const logRef = useRef(null);
  const debounce = useRef(null);

  const doc = buildDoc({ html: files['index.html'] || '', css: files['style.css'] || '', js: files['app.js'] || '' });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(files));
    } catch {}
  }, [files]);

  useEffect(() => {
    const h = (e) => {
      if (e.data && e.data.__nexus) setLogs((l) => [...l.slice(-200), { level: e.data.level, text: e.data.text }]);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const onChange = (v) => {
    setFiles((f) => ({ ...f, [active]: v }));
    if (auto) {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        setLogs([]);
        setNonce((n) => n + 1);
      }, 500);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = ta;
      const v = files[active];
      const next = v.slice(0, a) + '  ' + v.slice(b);
      setFiles((f) => ({ ...f, [active]: next }));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = a + 2;
      });
    }
  };

  const openExternal = useCallback(() => {
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [doc]);

  const download = () => {
    const blob = new Blob([doc], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nexusai-canvas.html';
    a.click();
    URL.revokeObjectURL(a.href);
    actions.toast('Canvas exported as standalone HTML ✓');
  };

  const askNexus = () => {
    const code = `index.html:\n${files['index.html']}\n\nstyle.css:\n${files['style.css']}\n\napp.js:\n${files['app.js']}`;
    actions.setView('chat');
    actions.sendMessage(`Improve this code — make it bolder, cleaner and more polished. Return the full updated files in fenced code blocks (html, css, js):\n\n${code.slice(0, 6000)}`);
  };

  return (
    <div className="page canvasview">
      <header className="page-head">
        <IconCode size={22} />
        <div>
          <h1>Canvas</h1>
          <p>Code side. Preview side. Zero friction.</p>
        </div>
        <div className="page-head-actions">
          <div className="pane-switch">
            <button className={pane === 'code' ? 'on' : ''} onClick={() => setPane('code')}>
              Code
            </button>
            <button className={pane === 'preview' ? 'on' : ''} onClick={() => setPane('preview')}>
              Preview
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Live
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => { setLogs([]); setNonce((n) => n + 1); }}>
            <IconPlay size={13} /> Run
          </button>
          <button className="btn btn-ghost btn-sm hide-sm" onClick={openExternal}>
            <IconExternal size={13} /> Open
          </button>
          <button className="btn btn-ghost btn-sm hide-sm" onClick={download}>
            <IconDownload size={13} /> Export
          </button>
          <button className="btn btn-acc btn-sm" onClick={askNexus}>
            <IconBolt size={13} /> Ask NexusAI
          </button>
        </div>
      </header>

      <div className="canvas-body">
        <div className={`canvas-editor ${pane !== 'code' ? 'pane-off' : ''}`}>
          <div className="file-tabs">
            {Object.keys(files).map((f) => (
              <button key={f} className={`file-tab ${active === f ? 'on' : ''}`} onClick={() => setActive(f)}>
                {f}
              </button>
            ))}
            <button
              className="file-tab reset"
              title="Reset to demo"
              onClick={() => {
                setFiles({ ...DEFAULT_FILES });
                setLogs([]);
                setNonce((n) => n + 1);
              }}
            >
              ⟲ Reset
            </button>
          </div>
          <textarea
            className="canvas-ta"
            spellCheck={false}
            value={files[active]}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        <div className={`canvas-preview ${pane !== 'preview' ? 'pane-off' : ''}`}>
          <div className="canvas-frame">
            <iframe key={nonce} title="canvas" sandbox="allow-scripts allow-modals allow-forms allow-popups" srcDoc={doc} />
          </div>
          <div className={`canvas-console ${showConsole ? '' : 'hidden'}`} ref={logRef}>
            <div className="pconsole-head" onClick={() => setShowConsole((x) => !x)}>
              <IconTerminal size={12} /> Console {logs.length ? `(${logs.length})` : ''}
            </div>
            {logs.map((l, i) => (
              <div key={i} className={`pconsole-line ${l.level}`}>
                <span className="pconsole-level">{l.level.toUpperCase()}</span> {l.text}
              </div>
            ))}
            {!logs.length && <div className="pconsole-line dim">— console output appears here —</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
