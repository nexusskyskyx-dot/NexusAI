import React, { useEffect, useRef, useState } from 'react';
import { useStore, actions } from '../store.js';
import Message from './Message.jsx';
import Composer from './Composer.jsx';
import AgentsPanel from './AgentsPanel.jsx';
import { Logo, IconAgents, IconDownload, IconPlus, IconSparkle, IconCode, IconBrain, IconBolt } from './Icons.jsx';

const SUGGESTIONS = [
  {
    icon: <IconCode size={16} />,
    title: 'Build a neon landing page',
    sub: 'HTML + CSS you can preview live',
    prompt: 'Build me a bold OLED-black landing page for a futuristic startup called Nova. Full HTML + CSS in one file, big bold typography, neon green accents.',
  },
  {
    icon: <IconBrain size={16} />,
    title: 'Reason through a hard problem',
    sub: 'watch the agents debate',
    prompt: 'Three doors, one guard always lies, one always tells the truth. What single question reveals the safe door? Explain step by step.',
  },
  {
    icon: <IconBolt size={16} />,
    title: 'Write a Python script',
    sub: 'complete, runnable code',
    prompt: 'Write a Python script that renames all files in a folder to kebab-case and prints a summary table of changes.',
  },
  {
    icon: <IconSparkle size={16} />,
    title: 'Explain anything simply',
    sub: 'clear, bold, structured',
    prompt: 'Explain how large language models work — for a smart 12-year-old. Use a great analogy and bold structure.',
  },
];

function Hero() {
  const s = useStore();
  const freeReady = !Object.values(s.keys).filter(Boolean).length;
  return (
    <div className="hero">
      <div className="hero-logo">
        <Logo size={58} />
      </div>
      <h1 className="hero-title">
        NEXUS<span>AI</span>
      </h1>
      <p className="hero-sub">Multi-agent chat intelligence</p>
      <div className="hero-pipeline">
        <span className="hp">Planner</span> <span className="hp-arrow">→</span>
        <span className="hp">Drafters</span> <span className="hp-arrow">→</span>
        <span className="hp">Reviewer</span> <span className="hp-arrow">→</span>
        <span className="hp">Synthesizer</span>
      </div>
      <p className="hero-models">DeepSeek · Qwen · Claude · GPT · free zero-key models</p>
      {freeReady ? (
        <div className="hero-free">
          <span className="led" /> Free mode active — no keys needed. Add keys anytime for frontier models.
        </div>
      ) : null}
      <div className="suggestions">
        {SUGGESTIONS.map((sg, i) => (
          <button key={i} className="suggestion" onClick={() => actions.sendMessage(sg.prompt)}>
            <span className="sg-icon">{sg.icon}</span>
            <span className="sg-title">{sg.title}</span>
            <span className="sg-sub">{sg.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatView() {
  const s = useStore();
  const conv = s.conversations.find((c) => c.id === s.activeId);
  const listRef = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const msgCount = conv?.messages.length || 0;
  const lastContent = conv?.messages[msgCount - 1]?.content?.length || 0;
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgCount, lastContent, s.activeId]);

  const exportChat = () => {
    if (!conv?.messages.length) return;
    const md =
      `# ${conv.title}\n\n` +
      conv.messages
        .map((m) => (m.role === 'user' ? `## 🧑 You\n\n${m.content}` : `## ⬡ NexusAI (${m.mode}${m.model ? ' · ' + m.model : ''})\n\n${m.content}`))
        .join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nexusai-chat.md';
    a.click();
    URL.revokeObjectURL(a.href);
    actions.toast('Chat exported as Markdown ✓');
  };

  const messages = conv?.messages || [];

  return (
    <div className="chatview">
      <header className="chat-head">
        <div className="chat-head-title">
          <span className="chat-head-name">{conv?.title || 'New chat'}</span>
          <span className="chat-head-meta">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'} ·{' '}
            {s.settings.mode === 'team' ? 'Team mode' : 'Solo mode'}
          </span>
        </div>
        <div className="chat-head-actions">
          {messages.some((m) => m.mode === 'team') ? (
            <button className={`btn btn-ghost btn-sm ${s.agentsOpen ? 'on' : ''}`} onClick={() => actions.setAgentsOpen(!s.agentsOpen)}>
              <IconAgents size={14} /> Pipeline
            </button>
          ) : null}
          {messages.length ? (
            <button className="btn btn-ghost btn-sm" onClick={exportChat} title="Export as Markdown">
              <IconDownload size={14} /> Export
            </button>
          ) : null}
          <button className="btn btn-ghost btn-sm hide-sm" onClick={() => actions.newConversation()}>
            <IconPlus size={14} /> New
          </button>
        </div>
      </header>

      <div className="chat-body">
        <div className="chat-scroll" ref={listRef}>
          {messages.length === 0 ? (
            <Hero />
          ) : (
            <div className="msg-list">
              {messages.map((m, i) => (
                <Message key={m.id} msg={m} isLast={i === messages.length - 1} />
              ))}
            </div>
          )}
        </div>
        <AgentsPanel />
      </div>

      <Composer />
    </div>
  );
}
