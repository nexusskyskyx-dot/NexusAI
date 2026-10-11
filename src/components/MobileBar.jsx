import React from 'react';
import { useStore, actions } from '../store.js';
import { Logo, IconMenu, IconPlus } from './Icons.jsx';

const VIEW_LABELS = { chat: 'Chat', agents: 'Agents', projects: 'Projects', canvas: 'Canvas', keys: 'Keys & Models' };

// Slim top bar shown only on phones — opens the sidebar drawer.
export default function MobileBar() {
  const s = useStore();
  return (
    <div className="mobilebar">
      <button className="mb-btn" onClick={() => actions.setSidebarOpen(true)} aria-label="Open menu">
        <IconMenu size={20} />
      </button>
      <div className="mb-brand" onClick={() => actions.setView('chat')}>
        <Logo size={22} />
        <span className="mb-title">
          NEXUS<b>AI</b>
        </span>
      </div>
      <span className="mb-view" key={s.view}>
        {VIEW_LABELS[s.view] || ''}
        {s.streaming ? <span className="led mb-live" /> : null}
      </span>
      {s.streaming ? (
        <button className="mb-btn" onClick={() => actions.stopGeneration()} aria-label="Stop generation">
          <span className="mb-stop" />
        </button>
      ) : (
        <button className="mb-btn" onClick={() => actions.newConversation()} aria-label="New chat">
          <IconPlus size={20} />
        </button>
      )}
    </div>
  );
}
