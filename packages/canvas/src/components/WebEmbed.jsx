/**
 * WebEmbed — iframe for external URLs.
 * Default component for canvas:web-embed messages.
 */

import React from 'react';

export default function WebEmbed({ payload }) {
  if (!payload?.url) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {payload.title && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', fontSize: '14px', fontWeight: 600, color: '#c9d1d9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{payload.title}</span>
          <a href={payload.url} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', fontSize: '12px', textDecoration: 'none' }}>
            Open in new tab ↗
          </a>
        </div>
      )}
      <iframe
        src={payload.url}
        style={{ flex: 1, border: 'none', background: '#0d1117' }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        title={payload.title || payload.url}
      />
    </div>
  );
}
