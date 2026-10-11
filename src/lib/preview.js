// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Live code preview builder
// Turns html / css / js code blocks into a full document rendered inside a
// sandboxed iframe, with console + error capture piped back to the parent.
// ─────────────────────────────────────────────────────────────────────────────

const CONSOLE_SHIM = `<script>
(function () {
  function fmt(a) {
    try {
      if (typeof a === 'string') return a;
      return JSON.stringify(a, null, 1) ?? String(a);
    } catch (e) { return String(a); }
  }
  function send(level, args) {
    try {
      parent.postMessage({ __nexus: true, level: level, text: Array.prototype.map.call(args, fmt).join(' ') }, '*');
    } catch (e) {}
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
    var orig = console[k];
    console[k] = function () { send(k, arguments); try { orig && orig.apply(console, arguments); } catch (e) {} };
  });
  window.addEventListener('error', function (e) {
    send('error', [e.message + '  (' + (e.lineno || 0) + ':' + (e.colno || 0) + ')']);
  });
  window.addEventListener('unhandledrejection', function (e) {
    send('error', ['Unhandled promise rejection: ' + fmt(e.reason)]);
  });
})();
</script>`;

const DEMO_CSS_WRAPPER = `<div class="demo">
  <h1>CSS Preview</h1>
  <p class="tag">Your stylesheet applied to demo markup</p>
  <button>Button</button>
  <div class="box"><span>Box</span></div>
  <input placeholder="Input" />
</div>`;

export function previewableLang(lang) {
  return /^(html|xml|svg|css|js|javascript|jsx)$/i.test(lang || '');
}

// buildDoc({ html, css, js }) → complete document string
export function buildDoc({ html = '', css = '', js = '' }) {
  const isFullDoc = /<html[\s>]/i.test(html);

  if (!isFullDoc) {
    const bodyContent = html || (css ? DEMO_CSS_WRAPPER : '<div id="app"></div>');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NexusAI Preview</title>
${CONSOLE_SHIM}
<style>
  :root { color-scheme: dark; }
  body { background:#000; color:#eee; font-family: system-ui, -apple-system, sans-serif; margin:0; padding:24px; }
</style>
<style>
${css}
</style>
</head>
<body>
${bodyContent}
<script>
${js}
<\/script>
</body>
</html>`;
  }

  // Full document: inject console shim (+ optional css/js) into <head>
  let doc = html;
  const inject = [CONSOLE_SHIM];
  if (css) inject.unshift(`<style>\n${css}\n</style>`);
  if (js) inject.unshift(`<script>\n${js}\n<\/script>`);
  const blob = inject.join('\n');
  if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, (m) => m + '\n' + blob);
  else if (/<html[^>]*>/i.test(doc)) doc = doc.replace(/<html[^>]*>/i, (m) => m + '\n' + blob);
  else doc = blob + doc;
  return doc;
}

// Build a doc from a single code block by language
export function buildDocFromBlock(code, lang) {
  const l = (lang || '').toLowerCase();
  if (l === 'css') return buildDoc({ css: code });
  if (l === 'js' || l === 'javascript' || l === 'jsx') return buildDoc({ js: code });
  return buildDoc({ html: code });
}

export function extForLang(lang) {
  const l = (lang || '').toLowerCase();
  if (l === 'css') return 'css';
  if (l === 'js' || l === 'javascript' || l === 'jsx') return 'js';
  if (l === 'html' || l === 'xml' || l === 'svg') return 'html';
  if (/python|py/.test(l)) return 'py';
  if (/typescript|ts/.test(l)) return 'ts';
  if (/json/.test(l)) return 'json';
  return 'txt';
}
