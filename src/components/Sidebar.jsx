import React from 'react';
import { useStore, actions } from '../store.js';
import { Logo, IconChat, IconAgents, IconCode, IconKeys, IconPlus, IconTrash, IconBolt, IconX } from './Icons.jsx';

const ACCENTS = [
  { id: 'green', c: '#00d492' },
  { id: 'cyan', c: '#4da3ff' },
  { id: 'violet', c: '#a78bfa' },
  { id: 'amber', c: '#e6a23c' },
  { id: 'pink', c: '#f26d8d' },
];

function NavItem({ icon, label, view, badge }) {
  const s = useStore();
  const active = s.view === view;
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => {
        actions.setView(view);
        actions.setSidebarOpen(false);
      }}
    >
      <span className="nav-ico">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

export default function Sidebar() {
  const s = useStore();
  const collapsed = !!s.settings.sidebarCollapsed;
  const open = !!s.sidebarOpen;
  const keyCount = Object.values(s.keys).filter(Boolean).length;
  const close = () => actions.setSidebarOpen(false);

  return (
    <>
      {open && <div className="backdrop" onClick={close} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo size={28} />
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">
                NEXUS<span className="brand-ai">AI</span>
              </div>
              <div className="brand-sub">Multi-agent intelligence</div>
            </div>
          )}
          <button className="icon-btn sidebar-close" onClick={close} aria-label="Close menu">
            <IconX size={18} />
          </button>
        </div>

        <button
          className="btn btn-acc btn-new"
          onClick={() => {
            actions.newConversation();
            close();
          }}
        >
          <IconPlus size={16} />
          {!collapsed && <span>New chat</span>}
        </button>

        <nav className="nav">
          <NavItem icon={<IconChat />} label="Chat" view="chat" />
          <NavItem icon={<IconAgents />} label="Agents" view="agents" />
          <NavItem icon={<IconCode />} label="Canvas" view="canvas" />
          <NavItem icon={<IconKeys />} label="Keys & Models" view="keys" badge={keyCount ? keyCount : 'FREE'} />
        </nav>

        {!collapsed && (
          <div className="convs">
            <div className="convs-label">Conversations</div>
            <div className="convs-list">
              {s.conversations.length === 0 && <div className="convs-empty">No chats yet — start one above.</div>}
              {s.conversations.map((c) => (
                <div
                  key={c.id}
                  className={`conv-item ${c.id === s.activeId && s.view === 'chat' ? 'active' : ''}`}
                  onClick={() => {
                    actions.selectConversation(c.id);
                    close();
                  }}
                >
                  <div className="conv-title">{c.title || 'New chat'}</div>
                  <div className="conv-meta">
                    {c.messages.find((m) => m.mode === 'team') ? 'Team' : c.messages.find((m) => m.kind === 'image') ? 'Image' : 'Solo'} ·{' '}
                    {new Date(c.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <button
                    className="conv-del"
                    title="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.deleteConversation(c.id);
                    }}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-foot">
          {!collapsed && (
            <div className="accents" title="Accent color">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className={`accent-dot ${s.settings.accent === a.id ? 'on' : ''}`}
                  style={{ background: a.c }}
                  onClick={() => actions.setAccent(a.id)}
                  aria-label={`accent ${a.id}`}
                />
              ))}
            </div>
          )}
          <button
            className="btn btn-ghost btn-collapse"
            onClick={() => actions.setSettings({ sidebarCollapsed: !collapsed })}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <IconBolt size={14} />
            {!collapsed && <span>Collapse</span>}
          </button>
          {!collapsed && (
            <div className={`server ${s.serverOk === null ? 'wait' : s.serverOk ? 'ok' : 'bad'}`}>
              <span className="led" />
              {s.serverOk === null ? 'Checking server…' : s.serverOk ? 'Server online' : 'Server offline'}
              <span className="ver">v1.0</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
