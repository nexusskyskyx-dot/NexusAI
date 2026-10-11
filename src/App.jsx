import React, { useEffect } from 'react';
import { useStore, actions } from './store.js';
import Sidebar from '@components/Sidebar.jsx';
import ChatView from '@components/ChatView.jsx';
import AgentsView from '@components/AgentsView.jsx';
import CanvasView from '@components/CanvasView.jsx';
import KeysView from '@components/KeysView.jsx';
import PreviewModal from '@components/PreviewModal.jsx';
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

  useEffect(() => {
    actions.boot();
    document.documentElement.dataset.acc = s.settings.accent || 'green';
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') actions.setAgentsOpen(false);
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
        {s.view === 'keys' && <KeysView />}
      </main>
      <PreviewModal />
      <Toasts />
    </div>
  );
}
