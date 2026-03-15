/**
 * Diagram — renders Mermaid diagrams in the visual panel.
 * Default component for canvas:diagram messages.
 */

import React, { useRef, useEffect, useState } from 'react';

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

export default function Diagram({ payload }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

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
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to render diagram');
      }
    })();

    return () => { cancelled = true; };
  }, [payload?.content]);

  if (!payload?.content) return null;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflow: 'auto' }}>
      {error ? (
        <div style={{ color: '#f85149', padding: '16px', background: '#161b22', borderRadius: '8px', border: '1px solid #f85149', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {error}
          <pre style={{ marginTop: '12px', color: '#8b949e', fontSize: '12px' }}>{payload.content}</pre>
        </div>
      ) : (
        <div ref={containerRef} style={{ maxWidth: '100%' }} />
      )}
    </div>
  );
}
