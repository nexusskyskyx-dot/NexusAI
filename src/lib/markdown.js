// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Markdown → sanitized HTML
// Two parser instances: a fast one for streaming (no syntax highlighting) and
// a full one with highlight.js for the final render. Keeps long streaming
// answers smooth — hljs only runs once, when the message completes.
// ─────────────────────────────────────────────────────────────────────────────
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

// DOMPurify needs a real DOM. In browsers it is always active; in DOM-less
// environments (Node SSR / smoke tests) it has no methods — degrade to the
// raw pipeline there instead of crashing.
const purify = typeof DOMPurify?.sanitize === 'function' ? DOMPurify : null;

const mdStream = new Marked({ breaks: true, gfm: true });

const mdFull = new Marked({ breaks: true, gfm: true });
mdFull.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        } catch {}
      }
      return '';
    },
  })
);

let hooked = false;
function hookPurify() {
  if (hooked || !purify) return;
  hooked = true;
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function renderMarkdown(text, { highlight = true } = {}) {
  hookPurify();
  const clean = String(text || '')
    // strip leaked chain-of-thought blocks from reasoning models
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>/gi, '');
  const parser = highlight ? mdFull : mdStream;
  const html = parser.parse(clean);
  return purify ? purify.sanitize(html, { ADD_ATTR: ['target', 'rel'] }) : html;
}
