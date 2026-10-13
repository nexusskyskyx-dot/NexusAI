import React, { useEffect, useState } from 'react';
import { Logo } from './Icons.jsx';
import { IconChevron } from './Icons.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Main Loader (v1.19) — the N hexagon pulsing blue while the team
// works, phase text that crossfades (old fades out, new fades in), and after
// the run: small folded badges you can click to unfold details.
// ─────────────────────────────────────────────────────────────────────────────

export const LOADER_TEXT = {
  thinking: 'NEXUSAI is thinking…',
  searching: 'NEXUSAI is searching…',
  planning: 'NEXUSAI is planning…',
  designing: 'NEXUSAI is designing…',
  coding: 'NEXUSAI is coding…',
  drawing: 'NEXUSAI is drawing…',
  writing: 'NEXUSAI is writing…',
  testing: 'NEXUSAI is testing…',
  previewing: 'NEXUSAI is previewing…',
};

// stage-id → loader phase, per pipeline
export const TEAM_PHASE = { research: 'searching', plan: 'planning', draft: 'coding', review: 'thinking', synthesize: 'writing' };
export const IMAGE_PHASE = { research: 'searching', enhance: 'thinking', generate: 'drawing', upscale: 'drawing', check: 'previewing' };
export const PROJECT_PHASE = { Coding: 'coding', Researching: 'searching', Thinking: 'thinking', Testing: 'testing', Reviewing: 'previewing', Debugging: 'coding', Documenting: 'writing', Reporting: 'writing', Designing: 'designing', Planning: 'planning', Searching: 'searching', Writing: 'writing', Previewing: 'previewing' };

// crossfade: current text fades in while the previous fades out — works in
// both directions (start→end and end→start)
function FadeText({ text }) {
  const [curr, setCurr] = useState(text);
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    if (text === curr) return;
    setPrev(curr);
    setCurr(text);
    const t = setTimeout(() => setPrev(null), 620);
    return () => clearTimeout(t);
  }, [text, curr]);
  return (
    <span className="ft">
      {prev != null ? <span className="ft-out" key={'p' + prev}>{prev}</span> : null}
      <span className="ft-in" key={'c' + curr}>{curr}</span>
    </span>
  );
}

// NexusLoader — hexagon pulsing blue + crossfading phase text + detail sub line
export default function NexusLoader({ phase = 'thinking', label, sub, size = 40, stop, onStop }) {
  const text = label || LOADER_TEXT[phase] || LOADER_TEXT.thinking;
  return (
    <div className="nx-loader">
      <span className="nx-hex" style={{ width: size, height: size }}>
        <Logo size={size} />
      </span>
      <span className="nx-loader-body">
        <span className="nx-loader-title">
          <FadeText text={text} />
        </span>
        {sub ? <span className="nx-loader-sub">{sub}</span> : null}
      </span>
      {stop ? (
        <button className="icon-btn" onClick={onStop} title="Stop">
          <IconChevron size={12} />
        </button>
      ) : null}
    </div>
  );
}

// Fold — a small badge, folded by default; click to unfold details
export function Fold({ label, tone = '', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fold ${open ? 'open' : ''} ${tone}`}>
      <button className="fold-head" onClick={() => setOpen((o) => !o)}>
        {label}
        <IconChevron size={11} className="fold-caret" />
      </button>
      {open && children ? <div className="fold-body">{children}</div> : null}
    </div>
  );
}

// FoldRow — the after-run summary: a row of folded badges
export function FoldRow({ children }) {
  return <div className="foldrow">{children}</div>;
}
