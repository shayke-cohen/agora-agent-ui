/**
 * Chat component — renders messages with markdown, inline buttons, and blocks.
 * Part of the fixed shell (framework-owned).
 */

import React, { useRef, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  userMsg: { alignSelf: 'flex-end', background: '#1f6feb', color: '#fff', padding: '10px 16px', borderRadius: '16px 16px 4px 16px', maxWidth: '80%', fontSize: '14px', lineHeight: 1.5 },
  assistantMsg: { alignSelf: 'flex-start', background: '#161b22', color: '#c9d1d9', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', maxWidth: '85%', fontSize: '14px', lineHeight: 1.6, border: '1px solid #30363d' },
  toolUse: { alignSelf: 'flex-start', background: '#0d1117', color: '#8b949e', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #21262d', fontFamily: 'monospace' },
  inputArea: { display: 'flex', padding: '12px 16px', borderTop: '1px solid #21262d', background: '#0d1117', gap: '8px' },
  input: { flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '10px 16px', color: '#c9d1d9', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: '40px', maxHeight: '120px' },
  sendBtn: { background: '#1f6feb', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' },
  stopBtn: { background: '#f85149', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  suggestion: { background: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' },
  suggestionsRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '8px 16px' },
  button: { background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  buttonSelected: { background: '#1f6feb', color: '#fff', border: '1px solid #1f6feb' },
  blockCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', margin: '8px 0' },
};

function renderMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(text, { breaks: true });
  return DOMPurify.sanitize(html);
}

function InlineButtons({ buttons, onSend }) {
  const [selected, setSelected] = useState({});
  return buttons.map(btn => (
    <div key={btn.id} style={{ margin: '8px 0' }}>
      {btn.prompt && <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '6px' }}>{btn.prompt}</div>}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {btn.options.map(opt => (
          <button key={opt.value}
            style={{ ...styles.button, ...(selected[btn.id] === opt.value ? styles.buttonSelected : {}) }}
            onClick={() => { setSelected(s => ({ ...s, [btn.id]: opt.value })); onSend(opt.value); }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ));
}

function InlineBlocks({ blocks }) {
  return blocks.map(block => {
    if (block.blockType === 'card') {
      const colors = { tip: '#58a6ff', warning: '#d29922', error: '#f85149', success: '#3fb950', concept: '#bc8cff' };
      return (
        <div key={block.id} style={{ ...styles.blockCard, borderLeft: `3px solid ${colors[block.type] || '#58a6ff'}` }}>
          {block.title && <div style={{ fontWeight: 600, marginBottom: '4px', color: colors[block.type] }}>{block.title}</div>}
          <div style={{ fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }} />
        </div>
      );
    }
    if (block.blockType === 'progress') {
      const pct = Math.round((block.current / block.total) * 100);
      return (
        <div key={block.id} style={{ margin: '8px 0' }}>
          {block.label && <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>{block.label}</div>}
          <div style={{ background: '#21262d', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#3fb950', height: '100%', width: `${pct}%`, borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>{block.current}/{block.total}</div>
        </div>
      );
    }
    if (block.blockType === 'list') {
      return (
        <div key={block.id} style={{ margin: '8px 0' }}>
          {block.items.map((item, i) => (
            <div key={i} style={{ ...styles.blockCard, display: 'flex', gap: '10px', alignItems: 'center', cursor: item.action ? 'pointer' : 'default' }}>
              {item.icon && <span style={{ fontSize: '18px' }}>{item.icon}</span>}
              <div>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.title}</div>
                {item.description && <div style={{ fontSize: '12px', color: '#8b949e' }}>{item.description}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (block.blockType === 'steps') {
      return (
        <div key={block.id} style={{ margin: '8px 0', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {block.steps.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: step.status === 'done' ? '#238636' : step.status === 'active' ? '#1f6feb' : '#21262d', color: step.status === 'pending' ? '#8b949e' : '#fff' }}>
                {step.label}
              </div>
              {i < block.steps.length - 1 && <span style={{ color: '#30363d' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return null;
  });
}

export default function Chat({ messages, onSend, onStop, isStreaming, suggestions }) {
  const messagesEndRef = useRef(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return <div key={i} style={styles.userMsg}>{msg.text}</div>;
          }
          if (msg.role === 'tool-use') {
            return <div key={i} style={styles.toolUse}>⚙ {msg.text || `Using ${msg.data?.toolName || 'tool'}`}</div>;
          }
          if (msg.role === 'assistant') {
            return (
              <div key={i} style={styles.assistantMsg}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                {msg.buttons && <InlineButtons buttons={msg.buttons} onSend={onSend} />}
                {msg.blocks && <InlineBlocks blocks={msg.blocks} />}
              </div>
            );
          }
          return null;
        })}
        <div ref={messagesEndRef} />
      </div>

      {suggestions && suggestions.length > 0 && (
        <div style={styles.suggestionsRow}>
          {suggestions.map((s, i) => (
            <button key={i} style={styles.suggestion} onClick={() => onSend(s.text)}>{s.label}</button>
          ))}
        </div>
      )}

      <div style={styles.inputArea}>
        <textarea
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
        />
        {isStreaming ? (
          <button style={styles.stopBtn} onClick={onStop}>Stop</button>
        ) : (
          <button style={styles.sendBtn} onClick={handleSend}>Send</button>
        )}
      </div>
    </div>
  );
}
