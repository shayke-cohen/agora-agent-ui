/**
 * HtmlContent — sandboxed iframe for rich HTML content.
 * Default component for canvas:html messages.
 */

import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

export default function HtmlContent({ payload }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current || !payload?.html) return;
    const clean = DOMPurify.sanitize(payload.html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] });
    const doc = iframeRef.current.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 16px; margin: 0; }
      a { color: #58a6ff; }
      img { max-width: 100%; border-radius: 8px; }
    </style></head><body>${clean}</body></html>`);
    doc.close();
  }, [payload?.html]);

  if (!payload?.html) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {payload.title && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', fontSize: '14px', fontWeight: 600, color: '#c9d1d9' }}>
          {payload.title}
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        style={{ flex: 1, border: 'none', background: '#0d1117' }}
        title={payload.title || 'Content'}
      />
    </div>
  );
}
