import React, { useEffect, useState, useRef, useCallback } from 'react';
import { buildDocFromBlock } from '@lib/preview.js';
import { IconX, IconMonitor, IconPhone, IconRefresh, IconExternal, IconTerminal, IconDownload } from './Icons.jsx';

export default function PreviewModal() {
  const [req, setReq] = useState(null); // {code, lang, title}
  const [doc, setDoc] = useState('');
  const [device, setDevice] = useState('desktop');
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(true);
  const [nonce, setNonce] = useState(0);
  const frameRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      const d = e.detail || {};
      setReq(d);
      setDoc(buildDocFromBlock(d.code || '', d.lang || 'html'));
      setLogs([]);
      setNonce((n) => n + 1);
    };
    window.addEventListener('nexus-preview', h);
    return () => window.removeEventListener('nexus-preview', h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.data && e.data.__nexus) {
        setLogs((l) => [...l.slice(-200), { level: e.data.level, text: e.data.text, ts: Date.now() }]);
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const openExternal = useCallback(() => {
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [doc]);

  if (!req) return null;

  return (
    <div className="pmodal">
      <div className="pmodal-bar">
        <span className="pmodal-title">▶ {req.title || 'LIVE PREVIEW'}</span>
        <span className="pmodal-actions">
          <button className={`btn btn-sm ${device === 'desktop' ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setDevice('desktop')} title="Desktop">
            <IconMonitor size={14} />
          </button>
          <button className={`btn btn-sm ${device === 'mobile' ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setDevice('mobile')} title="Mobile">
            <IconPhone size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setNonce((n) => n + 1)} title="Reload">
            <IconRefresh size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={openExternal} title="Open in new tab">
            <IconExternal size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowConsole((x) => !x)} title="Toggle console">
            <IconTerminal size={14} /> {logs.length ? `(${logs.length})` : ''}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setReq(null)} title="Close preview">
            <IconX size={14} />
          </button>
        </span>
      </div>
      <div className="pmodal-body">
        <div className={`pmodal-frame ${device}`}>
          <iframe
            key={nonce}
            ref={frameRef}
            title="preview"
            sandbox="allow-scripts allow-modals allow-forms allow-popups"
            srcDoc={doc}
          />
        </div>
        {showConsole ? (
          <div className="pmodal-console" ref={logRef}>
            <div className="pconsole-head">CONSOLE</div>
            {logs.length === 0 ? <div className="pconsole-line dim">— no output yet (console.log from the preview appears here) —</div> : null}
            {logs.map((l, i) => (
              <div key={i} className={`pconsole-line ${l.level}`}>
                <span className="pconsole-level">{l.level.toUpperCase()}</span> {l.text}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
