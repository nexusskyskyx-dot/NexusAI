import React, { useEffect, useRef } from 'react';
import { useStore, actions } from './store.js';
import Sidebar from '@components/Sidebar.jsx';
import ChatView from '@components/ChatView.jsx';
import AgentsView from '@components/AgentsView.jsx';
import CanvasView from '@components/CanvasView.jsx';
import KeysView from '@components/KeysView.jsx';
import ProjectsView from '@components/ProjectsView.jsx';
import PreviewModal from '@components/PreviewModal.jsx';
import ImageStudio from '@components/ImageStudio.jsx';
import MobileBar from '@components/MobileBar.jsx';

function Toasts() {
  const s = useStore();
  return (
    <div className="toasts">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const s = useStore();
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    actions.boot();
    document.documentElement.dataset.acc = s.settings.accent || 'green';
  }, []);

  // Escape closes things in priority order:
  // preview modal → image studio → sidebar drawer → agents panel
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      const previewOpen = !!window.__nexusPreview;
      window.dispatchEvent(new CustomEvent('nexus-escape'));
      if (previewOpen || sRef.current.studio) return; // overlays eat this Escape
      if (sRef.current.sidebarOpen) {
        actions.setSidebarOpen(false);
        return;
      }
      if (sRef.current.agentsOpen) actions.setAgentsOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="app">
      <MobileBar />
      <Sidebar />
      <main className="main">
        {s.view === 'chat' && <ChatView />}
        {s.view === 'agents' && <AgentsView />}
        {s.view === 'canvas' && <CanvasView />}
        {s.view === 'projects' && <ProjectsView />}
        {s.view === 'keys' && <KeysView />}
      </main>
      <PreviewModal />
      <ImageStudio />
      <Toasts />
    </div>
  );
}
