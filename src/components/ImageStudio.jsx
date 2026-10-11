import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore, actions } from '../store.js';
import { IconX, IconRefresh, IconDownload, IconEdit, IconCheck } from './Icons.jsx';

// ── filters ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'brightness', label: 'Brightness', min: 0, max: 200, def: 100, css: (v) => `brightness(${v}%)` },
  { id: 'contrast', label: 'Contrast', min: 0, max: 200, def: 100, css: (v) => `contrast(${v}%)` },
  { id: 'saturate', label: 'Saturation', min: 0, max: 200, def: 100, css: (v) => `saturate(${v}%)` },
  { id: 'hue', label: 'Hue', min: 0, max: 360, def: 0, css: (v) => `hue-rotate(${v}deg)` },
  { id: 'blur', label: 'Blur', min: 0, max: 10, def: 0, css: (v) => (v ? `blur(${v}px)` : '') },
  { id: 'grayscale', label: 'Grayscale', min: 0, max: 100, def: 0, css: (v) => (v ? `grayscale(${v}%)` : '') },
  { id: 'invert', label: 'Invert', min: 0, max: 100, def: 0, css: (v) => (v ? `invert(${v}%)` : '') },
];
const DEFAULT_FILTERS = Object.fromEntries(FILTERS.map((f) => [f.id, f.def]));
const PENS = ['#00d492', '#ffffff', '#ff5470', '#4da3ff', '#e6a23c', '#000000'];

function filterCss(f) {
  return FILTERS.map((x) => x.css(f[x.id])).filter(Boolean).join(' ') || 'none';
}

export default function ImageStudio() {
  const s = useStore();
  const studio = s.studio;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const annotRef = useRef(null); // offscreen annotation layer (image resolution)
  const imgRef = useRef(null);
  const stateRef = useRef({});

  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tool, setTool] = useState('pan'); // 'pan' | 'draw'
  const [pen, setPen] = useState({ color: '#00d492', size: 8 });
  const [strokeCount, setStrokeCount] = useState(0);
  const [tainted, setTainted] = useState(false);
  const [copied, setCopied] = useState(false);

  const img = studio?.img;

  // keep a ref mirror for the render loop
  useEffect(() => {
    stateRef.current = { zoom, rot, flipH, flipV, filters, offset: stateRef.current.offset || { x: 0, y: 0 } };
  }, [zoom, rot, flipH, flipV, filters]);

  // ── load image ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!img?.src) return;
    setLoaded(false);
    setLoadErr(null);
    setTainted(false);
    setZoom(1);
    setRot(0);
    setFlipH(false);
    setFlipV(false);
    setFilters({ ...DEFAULT_FILTERS });
    setTool('pan');
    setStrokeCount(0);
    stateRef.current = { zoom: 1, rot: 0, flipH: false, flipV: false, filters: { ...DEFAULT_FILTERS }, offset: { x: 0, y: 0 }, strokes: [] };
    const im = new Image();
    if (/^https?:/i.test(img.src)) im.crossOrigin = 'anonymous';
    im.onload = () => {
      imgRef.current = im;
      const a = document.createElement('canvas');
      a.width = im.naturalWidth;
      a.height = im.naturalHeight;
      annotRef.current = a;
      setLoaded(true);
      setTimeout(fit, 0);
    };
    im.onerror = () => setLoadErr('Could not load this image (it may have expired — regenerate it).');
    im.src = img.src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img?.src]);

  // ── render ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current;
    const im = imgRef.current;
    if (!c || !im) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth,
      H = c.clientHeight;
    if (c.width !== W * dpr || c.height !== H * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const st = stateRef.current;
    const iw = im.naturalWidth,
      ih = im.naturalHeight;
    ctx.save();
    ctx.translate(c.width / 2 + (st.offset?.x || 0) * dpr, c.height / 2 + (st.offset?.y || 0) * dpr);
    ctx.rotate(st.rot);
    ctx.scale((st.flipH ? -1 : 1) * st.zoom * dpr, (st.flipV ? -1 : 1) * st.zoom * dpr);
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = filterCss(st.filters);
    ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih);
    ctx.filter = 'none';
    const annot = annotRef.current;
    if (annot) ctx.drawImage(annot, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (loaded) draw();
  }, [loaded, zoom, rot, flipH, flipV, filters, draw, strokeCount]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const fit = useCallback(() => {
    const c = canvasRef.current;
    const im = imgRef.current;
    if (!c || !im) return;
    const rotated = stateRef.current.rot % Math.PI !== 0;
    const iw = rotated ? im.naturalHeight : im.naturalWidth;
    const ih = rotated ? im.naturalWidth : im.naturalHeight;
    const z = Math.min((c.clientWidth - 28) / iw, (c.clientHeight - 28) / ih, 2);
    stateRef.current.offset = { x: 0, y: 0 };
    setZoom(Math.max(0.05, z));
  }, []);

  // redraw annotation layer from stroke history
  const redrawAnnot = useCallback(() => {
    const a = annotRef.current;
    if (!a) return;
    const ctx = a.getContext('2d');
    ctx.clearRect(0, 0, a.width, a.height);
    for (const st of stateRef.current.strokes || []) {
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      st.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
  }, []);

  // ── pointer → image coords ────────────────────────────────────────────────
  const toImage = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const st = stateRef.current;
    const im = imgRef.current;
    const iw = im.naturalWidth,
      ih = im.naturalHeight;
    const px = e.clientX - rect.left - rect.width / 2 - (st.offset?.x || 0);
    const py = e.clientY - rect.top - rect.height / 2 - (st.offset?.y || 0);
    let x = px / st.zoom,
      y = py / st.zoom;
    const r = -st.rot;
    let xr = x * Math.cos(r) - y * Math.sin(r);
    let yr = x * Math.sin(r) + y * Math.cos(r);
    if (st.flipH) xr = -xr;
    if (st.flipV) yr = -yr;
    return { x: xr + iw / 2, y: yr + ih / 2 };
  };

  // ── pointer handlers (pan / draw / pinch) ─────────────────────────────────
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const onPointerDown = (e) => {
    if (!loaded) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom: stateRef.current.zoom };
      return;
    }
    const st = stateRef.current;
    if (tool === 'draw') {
      const pt = toImage(e);
      const stroke = { color: pen.color, size: pen.size, points: [pt] };
      st.strokes = [...(st.strokes || []), stroke];
      setStrokeCount(st.strokes.length);
    } else {
      st.panStart = { x: e.clientX, y: e.clientY, ox: st.offset?.x || 0, oy: st.offset?.y || 0 };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p1, p2] = [...pointers.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      setZoom(Math.max(0.05, Math.min(8, (pinch.current.zoom * d) / pinch.current.dist)));
      return;
    }
    const st = stateRef.current;
    if (tool === 'draw' && st.strokes?.length) {
      const stroke = st.strokes[st.strokes.length - 1];
      stroke.points.push(toImage(e));
      redrawAnnot();
      draw();
    } else if (st.panStart) {
      st.offset = {
        x: st.panStart.ox + (e.clientX - st.panStart.x),
        y: st.panStart.oy + (e.clientY - st.panStart.y),
      };
      draw();
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    stateRef.current.panStart = null;
  };

  const onWheel = (e) => {
    if (!loaded) return;
    e.preventDefault();
    setZoom((z) => Math.max(0.05, Math.min(8, z * (1 - e.deltaY * 0.0012))));
  };

  // ── actions ────────────────────────────────────────────────────────────────
  const undo = () => {
    const st = stateRef.current;
    if (st.strokes?.length) {
      st.strokes.pop();
      setStrokeCount(st.strokes.length);
      redrawAnnot();
      draw();
    }
  };

  const resetAll = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setRot(0);
    setFlipH(false);
    setFlipV(false);
    stateRef.current.strokes = [];
    setStrokeCount(0);
    redrawAnnot();
    setTimeout(fit, 0);
  };

  const exportCanvas = () => {
    const im = imgRef.current;
    const annot = annotRef.current;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.filter = filterCss(stateRef.current.filters);
    ctx.drawImage(im, 0, 0);
    ctx.filter = 'none';
    if (annot) ctx.drawImage(annot, 0, 0);
    return c;
  };

  const download = () => {
    try {
      exportCanvas().toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nexusai-${(img.prompt || 'image').replace(/[^a-z0-9]+/gi, '-').slice(0, 30).toLowerCase()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        actions.toast('Image exported as PNG ✓');
      }, 'image/png');
    } catch {
      setTainted(true);
      actions.toast('Export blocked: cross-origin image without CORS. Regenerate or use a Pollinations image.', 'error');
    }
  };

  const copyImage = async () => {
    try {
      const blob = await new Promise((res, rej) => exportCanvas().toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      actions.toast('Clipboard copy not available for this image', 'error');
    }
  };

  useEffect(() => {
    if (!studio) return;
    const h = (e) => {
      if (e.key === 'Escape') actions.closeStudio();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [studio]);

  if (!studio) return null;

  const edited = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) || rot !== 0 || flipH || flipV || strokeCount > 0;

  return (
    <div className="istudio">
      <div className="istudio-bar">
        <span className="istudio-title" title={img.prompt}>
          ✦ {img.prompt ? String(img.prompt).slice(0, 60) : 'Image'}
        </span>
        <span className="istudio-actions">
          <button className={`btn btn-sm ${tool === 'draw' ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setTool(tool === 'draw' ? 'pan' : 'draw')} title="Draw on the image">
            <IconEdit size={13} /> Draw
          </button>
          {tool === 'draw' && (
            <span className="pen-row">
              {PENS.map((c) => (
                <button key={c} className={`pen-dot ${pen.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setPen((p) => ({ ...p, color: c }))} aria-label={`pen ${c}`} />
              ))}
              <input type="range" min={2} max={40} value={pen.size} onChange={(e) => setPen((p) => ({ ...p, size: +e.target.value }))} title="Pen size" />
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!strokeCount} title="Undo stroke">
            ↩ Undo
          </button>
          <button className={`btn btn-sm ${filtersOpen ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setFiltersOpen((x) => !x)}>
            ☰ Adjust
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRot((r) => r + Math.PI / 2)} title="Rotate 90°">
            ⟳
          </button>
          <button className={`btn btn-sm ${flipH ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setFlipH((v) => !v)} title="Flip horizontal">
            ⇋
          </button>
          <button className={`btn btn-sm ${flipV ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setFlipV((v) => !v)} title="Flip vertical">
            ⇅
          </button>
          {edited ? (
            <button className="btn btn-ghost btn-sm" onClick={resetAll} title="Reset edits">
              <IconRefresh size={13} />
            </button>
          ) : null}
          <button className="btn btn-ghost btn-sm" onClick={copyImage} title="Copy to clipboard">
            {copied ? <IconCheck size={13} /> : '⧉'}
          </button>
          <button className="btn btn-acc btn-sm" onClick={download} disabled={!loaded || tainted}>
            <IconDownload size={13} /> PNG
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => actions.closeStudio()} title="Close">
            <IconX size={14} />
          </button>
        </span>
      </div>

      {filtersOpen && (
        <div className="istudio-filters">
          {FILTERS.map((f) => (
            <label key={f.id} className="ifilter">
              <span className="ifilter-label">
                {f.label} <b>{filters[f.id]}{f.id === 'hue' ? '°' : f.id === 'blur' ? 'px' : '%'}</b>
              </span>
              <input
                type="range"
                min={f.min}
                max={f.max}
                value={filters[f.id]}
                onChange={(e) => setFilters((x) => ({ ...x, [f.id]: +e.target.value }))}
              />
            </label>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
            Reset adjustments
          </button>
        </div>
      )}

      <div className="istudio-body" ref={wrapRef}>
        <div className="istudio-canvaswrap">
          {loadErr ? (
            <div className="istudio-error">⚠ {loadErr}</div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`istudio-canvas ${tool === 'draw' ? 'drawing' : 'panning'}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            />
          )}
        </div>
        <div className="istudio-zoom">
          <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.05, z / 1.25))}>
            −
          </button>
          <span className="istudio-zoomval">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>
            +
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fit}>
            Fit
          </button>
          <span className="istudio-meta">
            {img.model} · {img.w}×{img.h}
            {strokeCount ? ` · ${strokeCount} strokes` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
