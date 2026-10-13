// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Intent Router — type anything, NexusAI sends it to the right team
// ─────────────────────────────────────────────────────────────────────────────
// detectIntent(text) → { mode: 'image'|'project'|'search'|'chat', smalltalk }
//
//   "Make a car with neon light image"   → image
//   "Make a Tesla store project"         → project
//   "Search about cars with neon lights" → search
//   "Hello how are you"                  → chat (+smalltalk → fast solo reply)
//
// Pure + deterministic — the composer shows the verdict live before you send,
// and the store routes the generation on it. One-click override always wins
// (settings.autoIntent === false → this module is skipped entirely).

const IMAGE_RE =
  /\b(image|images|picture|pictures|photo|photos|photograph|draw|drawing|paint|painting|sketch|illustration|wallpaper|poster|logo|icon|avatar|artwork|art of|mockup|portrait)\b/i;

const PROJECT_EXPLICIT =
  /\b(project|website|web ?site|web ?app|landing ?page|home ?page|web ?page|portfolio site|online store|e-?commerce|full ?stack|clone)\b/i;

const PROJECT_BUILD =
  /\b(build|make|create|design|develop|code)\b[^.?!]{0,60}\b(site|website|app|application|game|store|shop|platform|dashboard|tracker|tool|blog|forum|page)\b/i;

const SEARCH_RE =
  /^\s*(search( about| for| the web for)?|google( about| for)?|look ?up|find( me| out)?( about| how| why)?|research( about| on)?|what('s| is| are| was| were)|who('s| is| are| was)|where( is| are| was)|latest (on|news|about)|news (about|on))\b/i;

const SMALLTALK_RE =
  /^\s*(hi|hello|hey|yo|sup|hola|thanks|thank you|thx|good (morning|afternoon|evening|night)|what'?s up|how are you( doing)?|how'?s it going|bye|goodbye|see ya)\b[!,.? ]*(there|how are you( doing)?|what'?s up|how'?s it going|and you)?[!,.? ]*$/i;

export function detectIntent(text) {
  const t = String(text || '');
  if (!t.trim()) return { mode: 'chat' };

  // 1 · an explicit "project" beats everything — the user said the word
  if (/\bproject\b/i.test(t)) return { mode: 'project' };

  // 2 · image words are very specific — they beat generic build phrasing
  if (IMAGE_RE.test(t)) return { mode: 'image' };

  // 3 · build-a-thing phrasing → the project team
  if (PROJECT_EXPLICIT.test(t) || PROJECT_BUILD.test(t)) return { mode: 'project' };

  // 4 · research openers → web-first answer
  if (SEARCH_RE.test(t)) return { mode: 'search' };

  // 5 · everything else is chat; pure small talk gets the fast lane
  return { mode: 'chat', smalltalk: SMALLTALK_RE.test(t) && t.split(/\s+/).length <= 7 };
}

// human labels for the live chip + toasts
export const INTENT_LABEL = {
  image: '🎨 Image',
  project: '🛠 Project',
  search: '🔍 Research',
  chat: '💬 Chat',
  solo: '⚡ Solo',
  team: '⬡ Team',
};

// glyph-only map for the composer chip
export const INTENT_GLYPH = {
  image: '🎨', project: '🛠', search: '🔍', chat: '💬', solo: '⚡', team: '⬡',
};
