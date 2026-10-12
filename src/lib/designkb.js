// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Design Knowledge Base
//
// Deterministic, offline library of CURRENT (2026-era) web design systems.
// The Designer agent receives a tailored pack (style, palette, typography,
// layout, motion, quality bar) before writing any file — so generated
// projects look designed, not boring. Pair with live trend research
// (websearch.researchDesign) for freshness.
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = [
  {
    id: 'aurora-glass',
    name: 'Aurora Glass (2026)',
    keywords: /dark|neon|futuristic|tech|ai|cyber|space|glow|modern|premium|landing|startup|saas/i,
    text: `STYLE: Aurora Glass — dark, luminous, depth through frosted-glass layers (the 2026 look).
PALETTE: bg #050507 · surface rgba(255,255,255,.045) · border rgba(255,255,255,.12) · text #f2f3f7 · muted #9ba0ab · accent #7c5cff · accent2 #22d3ee.
TYPOGRAPHY: display "Space Grotesk"/system-ui 700 with clamp() scale; body Inter/system 400-600; labels mono uppercase, letter-spacing .12em, 10-11px.
RULES:
- glass cards: background rgba(255,255,255,.045); backdrop-filter blur(14px); 1px border rgba(255,255,255,.12); radius 18-24px
- aurora backdrop: fixed radial-gradients (two accent hues, ~12-16% opacity) behind the hero only, never under body text
- gradient wordmark: linear-gradient(180deg,#fff,#b9bdc9) with background-clip:text on the h1
- hover: translateY(-2px) + colored glow box-shadow; transitions 200-300ms cubic-bezier(.22,.68,.32,1)
- spacing scale 4/8/12/16/24/32/48/64; content shell max-width ~1100px
LAYOUT: centered hero (gradient headline + one-line sub + CTA) → row of 3 glass feature cards → footer strip.
QUALITY BAR: no default browser blue, no flat single-color background, every interactive element has hover AND :focus-visible states, prefers-reduced-motion respected, text contrast ≥ 4.5:1.`,
  },
  {
    id: 'bento-tech',
    name: 'Bento Tech (Linear/Vercel vibe)',
    keywords: /app|dashboard|analytics|tool|productivity|saas|platform|manager|tracker|kanban|crm|admin/i,
    text: `STYLE: Bento Tech — modular bento grid, quiet graphite surfaces, mono labels (the Linear/Vercel school).
PALETTE: bg #0a0a0c · card #101014 · border #1e1e24 · text #f0f1f4 · muted #8b8f9a · accent #dcdde2 (platinum) with one signal color #4da3ff.
TYPOGRAPHY: UI Inter 500-600 13-15px; numbers + labels "JetBrains Mono"/mono 10-11px uppercase tracking wide; page titles 18-22px 650 weight.
RULES:
- bento grid: CSS grid with mixed span cells (2x2 hero stat, 1x1 metric, 2x1 chart), gap 10-14px
- cards: #101014 on #0a0a0c, 1px #1e1e24 border, radius 14-16px, NO drop shadows
- accents used sparingly: one active state, one chart line, one badge — never full fills
- data-first: real numbers, sparkline SVGs, progress bars with rounded caps
- micro-interactions only: 120-150ms background/border color shifts
LAYOUT: slim top bar → bento grid of stats/actions → detail list or table.
QUALITY BAR: no rainbow colors, no gradients on large surfaces, alignment to a 4px grid, empty states designed (not blank).`,
  },
  {
    id: 'editorial-luxe',
    name: 'Editorial Luxe',
    keywords: /portfolio|magazine|blog|editorial|writer|photograph|fashion|luxury|resume|cv|journal|gallery|architecture|studio/i,
    text: `STYLE: Editorial Luxe — print-magazine discipline on the web; typography does the talking.
PALETTE: paper #faf9f6 or ink #0d0d0c · text #1a1a18 · muted #7a7a72 · hairline #e4e2db · one accent: oxblood #7a2e2e or gold #b08d3e.
TYPOGRAPHY: display serif ("Playfair Display"/Georgia) 600-700, huge scale (clamp 40-84px), tight leading; body 16-18px/1.7; italic pull-quotes; small-caps labels.
RULES:
- hairline rules (1px) instead of boxes; sections separated by whitespace, not borders
- asymmetric grid: 12-column with deliberate offsets (image 7 cols, caption 4, gutter 1)
- images full-bleed or framed with generous margins; subtle grayscale-on-hover → color
- slow fades only (400-600ms ease); scroll-triggered reveals at 60% viewport
LAYOUT: oversized serif hero with index-style nav → alternating work entries (image + meta) → contact strip with big mailto.
QUALITY BAR: never more than 2 typefaces, never centered body text, every project entry has real-feeling title/year/role meta.`,
  },
  {
    id: 'neo-brutal',
    name: 'Neo-Brutalist Pop',
    keywords: /bold|playful|fun|poster|event|music|festival|arcade|sport|energetic|street|skate|game(?!.*(snake|pong|terminal))/i,
    text: `STYLE: Neo-Brutalist Pop — loud, physical, unapologetic.
PALETTE: bg #fff8ec or #111 · ink #111 · accent #ff5470 · accent2 #ffe066 · accent3 #4da3ff · shadows are HARD (no blur).
TYPOGRAPHY: display "Archivo Black"/900 uppercase, tight tracking; body "Space Grotesk" 500; sizes jump dramatically (16 → 96px).
RULES:
- 3-4px solid #111 borders on everything; offset shadows (6px 6px 0 #111); radius 0-12px max
- buttons physically press: translate(4px,4px) + shadow removed on :active
- rotated sticker badges (-6deg), marquee ticker strips, high-contrast hover inversions
- background patterns: dotted grids or diagonal stripes at low opacity
LAYOUT: full-width marquee → jumbo headline with sticker → 2-col feature blocks with alternating rotation → big footer CTA.
QUALITY BAR: max 4 colors, shadows always hard (0 blur), text never on patterned background without solid plate.`,
  },
  {
    id: 'retro-terminal',
    name: 'Retro Terminal',
    keywords: /snake|pong|tetris|retro|terminal|hacker|dos|arcade|8-bit|8 bit|pixel|cyberpunk|command/i,
    text: `STYLE: Retro Terminal — CRT arcade energy, phosphor glow.
PALETTE: bg #050805 · phosphor #33ff66 (or amber #ffb000) · dim #1c7a3c · scanline rgba(0,0,0,.25).
TYPOGRAPHY: everything mono ("VT323"/"IBM Plex Mono") 16-20px; headings ASCII-block style with letter-spacing.
RULES:
- scanline overlay: repeating-linear-gradient 3px, opacity .15, pointer-events none
- glow: text-shadow 0 0 8px currentColor on scores/labels; NO glow on body paragraphs
- chunky pixel borders (4px double or box-drawing chars in ::before)
- blink animation on cursors (steps(1)); 60fps canvas rendering for the game area
- sound: tiny WebAudio beeps on events (oscillator square, 60-90ms)
LAYOUT: title bar with score pills → centered canvas/board → key legend footer.
QUALITY BAR: playable area ≥ 60% of viewport, all keys documented, pause + restart supported.`,
  },
  {
    id: 'soft-gradient',
    name: 'Soft Gradient Friendly',
    keywords: /recipe|health|kids|friendly|store|shop|wellness|travel|food|restaurant|cafe|bakery|plant|yoga|charity/i,
    text: `STYLE: Soft Gradient Friendly — warm, rounded, approachable.
PALETTE: bg #fffdfa · surface #fff · wash linear-gradient(135deg,#ffe9f0,#e8f4ff) · text #2b2b33 · muted #8a8a94 · accent #ff7aa2 · accent2 #6db1ff.
TYPOGRAPHY: display "DM Sans"/700 rounded-feel 32-56px; body 15-16px/1.65; chips 12px 600.
RULES:
- radius 20-28px on cards, 999px on pills/buttons; soft shadows 0 12px 32px rgba(180,160,200,.18)
- gradient washes on section backgrounds and hero only; cards stay white
- friendly micro-motion: scale(1.03) hover on cards, 250ms spring-ish easing
- illustration energy: emoji or simple SVG doodles in section headers
LAYOUT: gradient hero with search/CTA → card grid (3-up) with image tops → pastel stats band → simple footer.
QUALITY BAR: never more than one gradient per viewport, body text always on solid white, buttons ≥ 44px tall.`,
  },
];

const DEFAULT_STYLE = STYLES[0];

export function designPack(idea) {
  const text = String(idea || '');
  let best = null;
  let bestScore = 0;
  for (const st of STYLES) {
    // count every keyword hit (global match), not just first-match-wins
    const re = new RegExp(st.keywords.source, st.keywords.flags.includes('g') ? st.keywords.flags : st.keywords.flags + 'g');
    const hits = text.match(re);
    if (hits && hits.length > bestScore) {
      bestScore = hits.length;
      best = st;
    }
  }
  const style = best || DEFAULT_STYLE;
  return { id: style.id, name: style.name, text: style.text };
}

export function designStyles() {
  return STYLES.map((s) => ({ id: s.id, name: s.name }));
}
