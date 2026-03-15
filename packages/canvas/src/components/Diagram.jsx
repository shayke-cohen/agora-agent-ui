/**
 * Diagram — renders Mermaid diagrams with zoom, pan, and fit-to-canvas.
 * Default component for canvas:diagram messages.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const ZOOM_WHEEL_SENSITIVITY = 0.002;

let mermaidInitialized = false;

async function initMermaid() {
  if (mermaidInitialized) return;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#1f6feb',
      primaryTextColor: '#c9d1d9',
      primaryBorderColor: '#30363d',
      lineColor: '#8b949e',
      secondaryColor: '#161b22',
      tertiaryColor: '#21262d',
    },
  });
  mermaidInitialized = true;
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8 },
  zoomControls: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '8px 24px 0' },
  zoomButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 28, fontSize: 14, fontWeight: 500,
    color: '#8b949e', backgroundColor: '#21262d', border: '1px solid #30363d',
    borderRadius: 6, cursor: 'pointer', padding: 0, lineHeight: 1,
  },
  zoomLevel: { fontSize: 12, color: '#8b949e', minWidth: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  zoomDivider: { width: 1, height: 16, backgroundColor: '#30363d', margin: '0 4px' },
  wrapper: {
    backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 12,
    flex: 1, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', touchAction: 'none', userSelect: 'none',
    margin: '0 24px 24px',
  },
  diagram: { transformOrigin: 'center center', transition: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  errorBox: { color: '#f85149', padding: '16px', background: '#161b22', borderRadius: '8px', border: '1px solid #f85149', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', textAlign: 'center' },
};

export default function Diagram({ payload }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const fitToCanvas = useCallback(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const svgW = svg.getAttribute('width') ? parseFloat(svg.getAttribute('width')) : svg.getBBox?.()?.width || svg.viewBox?.baseVal?.width || 0;
    const svgH = svg.getAttribute('height') ? parseFloat(svg.getAttribute('height')) : svg.getBBox?.()?.height || svg.viewBox?.baseVal?.height || 0;

    if (!svgW || !svgH) return;

    const padX = 48;
    const padY = 48;
    const availW = wrapperRect.width - padX;
    const availH = wrapperRect.height - padY;
    if (availW <= 0 || availH <= 0) return;

    const scaleX = availW / svgW;
    const scaleY = availH / svgH;
    const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM);
    setZoom(Math.max(MIN_ZOOM, newZoom));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!payload?.content) return;

    let cancelled = false;
    (async () => {
      try {
        await initMermaid();
        const { default: mermaid } = await import('mermaid');
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, payload.content);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
          requestAnimationFrame(() => fitToCanvas());
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to render diagram');
      }
    })();

    return () => { cancelled = true; };
  }, [payload?.content, fitToCanvas]);

  function handleZoomIn() { setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM)); }
  function handleZoomOut() { setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM)); }
  function handleResetZoom() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function handleWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY;
    setZoom(z => Math.min(Math.max(z + delta * z, MIN_ZOOM), MAX_ZOOM));
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!isPanning.current) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    });
  }

  function handlePointerUp() { isPanning.current = false; }

  if (!payload?.content) return null;

  return (
    <div style={s.container}>
      <div style={s.zoomControls}>
        <button onClick={handleZoomOut} style={s.zoomButton} title="Zoom out" aria-label="Zoom out">&minus;</button>
        <span style={s.zoomLevel}>{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} style={s.zoomButton} title="Zoom in" aria-label="Zoom in">+</button>
        <div style={s.zoomDivider} />
        <button onClick={fitToCanvas} style={s.zoomButton} title="Fit to canvas" aria-label="Fit to canvas">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,5 1,1 5,1" />
            <polyline points="9,1 13,1 13,5" />
            <polyline points="13,9 13,13 9,13" />
            <polyline points="5,13 1,13 1,9" />
          </svg>
        </button>
        <button onClick={handleResetZoom} style={s.zoomButton} title="Reset zoom (100%)" aria-label="Reset zoom">1:1</button>
      </div>

      <div
        ref={wrapperRef}
        style={s.wrapper}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {error ? (
          <div style={s.errorBox}>
            <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Render Error</p>
            <pre style={{ fontSize: 13, margin: '0 0 8px' }}>{error}</pre>
            <pre style={{ color: '#8b949e', fontSize: 12 }}>{payload.content}</pre>
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              ...s.diagram,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: isPanning.current ? 'grabbing' : 'grab',
            }}
          />
        )}
      </div>
    </div>
  );
}
