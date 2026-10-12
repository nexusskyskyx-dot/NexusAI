import React, { useEffect, useRef, useState } from 'react';
import { useStore, actions } from '../store.js';
import Message from './Message.jsx';
import Composer from './Composer.jsx';
import AgentsPanel from './AgentsPanel.jsx';
import { Logo, IconSparkle, IconCode, IconBrain, IconBolt, IconImage, IconRocket } from './Icons.jsx';

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
  {
    icon: <IconImage size={16} />,
    title: 'Generate an image',
    sub: 'free · no key needed',
    mode: 'image',
    prompt: 'A futuristic OLED-black megacity at night, neon emerald light trails, cinematic wide shot, ultra detailed, moody atmosphere',
  },
  {
    icon: <IconRocket size={16} />,
    title: 'Build a full project',
    sub: 'the whole agent team codes it',
    view: 'projects',
    prompt: '',
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
      <p className="hero-models">DeepSeek · Qwen · Claude · GPT · Gemini · Groq · GitHub · free models</p>
      {freeReady ? (
        <div className="hero-free">
          <span className="led" /> Free mode active — no keys needed. Add keys anytime for frontier models.
        </div>
      ) : null}
      <div className="suggestions">
        {SUGGESTIONS.map((sg, i) => (
        <button
          key={i}
          className="suggestion"
          onClick={() => {
            if (sg.view) {
              actions.setView(sg.view);
              return;
            }
            if (sg.mode) actions.setSettings({ mode: sg.mode });
            actions.sendMessage(sg.prompt);
          }}
        >
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

  const messages = conv?.messages || [];

  return (
    <div className="chatview">
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
