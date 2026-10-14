import React, { useState } from 'react';
import { useStore, actions } from '../store.js';
import { BrandLogo, IconChat, IconAgents, IconCode, IconKeys, IconPlus, IconTrash, IconBolt, IconX, IconFolder, IconEdit } from './Icons.jsx';

const ACCENTS = [
  { id: 'blue', c: '#2f6bff' },
  { id: 'platinum', c: '#dcdde2' },
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
  const [q, setQ] = useState('');

  // searchable history: match title OR any message content
  const term = q.trim().toLowerCase();
  const visible = !term
    ? s.conversations
    : s.conversations.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(term) ||
          c.messages.some((m) => String(m.content || '').toLowerCase().includes(term))
      );
  const DAY = 86400000;
  const age = (ts) => Date.now() - ts;
  const GROUPS = [
    ['Today', visible.filter((c) => age(c.ts) < DAY)],
    ['Yesterday', visible.filter((c) => age(c.ts) >= DAY && age(c.ts) < 2 * DAY)],
    ['Previous 7 days', visible.filter((c) => age(c.ts) >= 2 * DAY && age(c.ts) < 7 * DAY)],
    ['Older', visible.filter((c) => age(c.ts) >= 7 * DAY)],
  ];

  return (
    <>
      {open && <div className="backdrop" onClick={close} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}>
        <div className="brand">
          <BrandLogo size={30} />
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
          <NavItem icon={<IconFolder />} label="Projects" view="projects" badge={s.projects.length || null} />
          <NavItem icon={<IconKeys />} label="Keys & Models" view="keys" badge={keyCount ? keyCount : 'FREE'} />
        </nav>

        {!collapsed && (
          <div className="convs">
            <div className="convs-label">Conversations</div>
            <div className="conv-search">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chats…"
                aria-label="Search conversations"
              />
              {q ? (
                <button className="conv-search-x" title="Clear search" onClick={() => setQ('')}>
                  <IconX size={12} />
                </button>
              ) : null}
            </div>
            <div className="convs-list">
              {s.conversations.length === 0 && <div className="convs-empty">No chats yet — start one above.</div>}
              {visible.length === 0 && s.conversations.length > 0 && (
                <div className="convs-empty">No chats match “{q.trim()}”.</div>
              )}
              {GROUPS.map(([label, list]) =>
                list.length ? (
                  <div key={label} className="conv-group">
                    <div className="conv-group-label">{label}</div>
                    {list.map((c) => (
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
                          {c.messages.find((m) => m.mode === 'team') ? 'Team' : c.messages.find((m) => m.kind === 'image') ? 'Image' : 'Solo'} · {c.messages.length} msg
                        </div>
                        <span className="conv-actions">
                          <button
                            className="conv-del"
                            title="Rename chat"
                            onClick={(e) => {
                              e.stopPropagation();
                              const t = window.prompt('Rename chat', c.title || '');
                              if (t && t.trim()) actions.renameConversation(c.id, t.trim());
                            }}
                          >
                            <IconEdit size={12} />
                          </button>
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
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null
              )}
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
