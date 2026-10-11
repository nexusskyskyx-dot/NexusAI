// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Markdown → sanitized HTML with optional syntax highlighting
// ─────────────────────────────────────────────────────────────────────────────
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

let configured = false;
function configure() {
  if (configured) return;
  configured = true;
  marked.use(
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
  marked.use({ breaks: true, gfm: true });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function renderMarkdown(text, { highlight = true } = {}) {
  configure();
  const clean = String(text || '')
    // strip leaked chain-of-thought blocks from reasoning models
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>/gi, '');
  let html;
  if (highlight) {
    html = marked.parse(clean);
  } else {
    // cheap escape path during streaming (fast, no highlight flicker)
    html = marked.parse(clean, { renderer: undefined });
  }
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
  });
}
