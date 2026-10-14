import React, { useEffect, useRef, useState } from 'react';
import { useStore, actions } from '../store.js';
import Message from './Message.jsx';
import Composer from './Composer.jsx';
import AgentsPanel from './AgentsPanel.jsx';
import { BrandLogo, IconSparkle, IconCode, IconBrain, IconBolt, IconImage, IconRocket } from './Icons.jsx';

const SUGGESTIONS = [
  {
    icon: <IconBolt size={17} />,
    title: 'Research anything, live',
    sub: 'reads real sources, cites them',
    prompt: 'Research the best free AI models available right now and compare their speed, context and limits. Cite sources.',
  },
  {
    icon: <IconCode size={17} />,
    title: 'Build a neon landing page',
    sub: 'HTML + CSS with live preview',
    prompt: 'Build me a bold OLED-black landing page for a futuristic startup called Nova. Full HTML + CSS in one file, big bold typography, saturated blue accents.',
  },
  {
    icon: <IconImage size={17} />,
    title: 'Generate an image',
    sub: 'free · no key needed',
    mode: 'image',
    prompt: 'A futuristic OLED-black megacity at night, saturated blue light trails, cinematic wide shot, ultra detailed, moody atmosphere',
  },
  {
    icon: <IconBrain size={17} />,
    title: 'Reason with the agent team',
    sub: 'planner · drafters · reviewer',
    prompt: 'Three doors, one guard always lies, one always tells the truth. What single question reveals the safe door? Show the reasoning.',
  },
];

function Hero() {
  const s = useStore();
  const freeReady = !Object.values(s.keys).filter(Boolean).length;
  return (
    <div className="hero">
      <div className="hero-logo">
        <BrandLogo size={72} />
      </div>
      <div className="hero-eyebrow">NEXUSAI · MULTI-AGENT CHAT</div>
      <h1 className="hero-title">Where should we start?</h1>
      <p className="hero-sub">
        Chat, research the live web, generate images, or set the agent team on a hard problem — auto-routed from one box.
      </p>
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
            <span className="sg-body">
              <span className="sg-title">{sg.title}</span>
              <span className="sg-sub">{sg.sub}</span>
            </span>
            <span className="sg-arrow">→</span>
          </button>
        ))}
      </div>
      <div className="hero-foot">
        {freeReady ? (
          <span className="hero-free"><span className="led" /> Free mode — no keys needed</span>
        ) : (
          <span className="hero-free"><span className="led on" /> Keys connected · frontier models unlocked</span>
        )}
        <span className="hero-models">Gemini · GPT · Claude · DeepSeek · Qwen · Mistral · Groq · 55 xKiro free models</span>
      </div>
    </div>
  );
}

export default function ChatView() {
  const s = useStore();
  const conv = s.conversations.find((c) => c.id === s.activeId);
  const listRef = useRef(null);
  const stickRef = useRef(true);
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        stickRef.current = stick;
        setBehind(!stick);
      });
    };
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const jumpLatest = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

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
          {behind && messages.length ? (
            <button className="jump-latest" onClick={jumpLatest} title="Jump to latest">
              ↓ Latest
            </button>
          ) : null}
        </div>
        <AgentsPanel />
      </div>

      <Composer />
    </div>
  );
}
