/**
 * Chat component — renders messages with markdown, inline buttons, and blocks.
 * Part of the fixed shell (framework-owned).
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
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

const BUTTONS_RE = /<!--\s*buttons:\s*(\{[\s\S]*?\})\s*-->/g;
const VALID_BTN_TYPES = ['single', 'multi', 'rating'];
const SUGGESTIONS_RE = /<!--\s*suggestions:\s*(\[[\s\S]*?\])\s*-->/;
const CANVAS_CMD_RE = /<!--\s*canvas:\w[\w-]*:\s*\{[\s\S]*?\}\s*-->/g;
const BLOCK_PATTERNS = [
  { re: /<!--\s*list:\s*(\{[\s\S]*?\})\s*-->/g, type: 'list', required: ['items'] },
  { re: /<!--\s*progress:\s*(\{[\s\S]*?\})\s*-->/g, type: 'progress', required: ['current', 'total'] },
  { re: /<!--\s*card:\s*(\{[\s\S]*?\})\s*-->/g, type: 'card', required: ['content'] },
  { re: /<!--\s*code:\s*(\{[\s\S]*?\})\s*-->/g, type: 'code', required: ['code'] },
  { re: /<!--\s*steps:\s*(\{[\s\S]*?\})\s*-->/g, type: 'steps', required: ['steps'] },
];

function parseButtonsFromText(text) {
  if (!text) return { cleanText: '', buttons: [] };
  const buttons = [];
  let cleanText = text;
  for (const m of [...text.matchAll(BUTTONS_RE)]) {
    let p;
    try { p = JSON.parse(m[1]); } catch { continue; }
    if (!p || typeof p !== 'object') continue;
    if (typeof p.id !== 'string' || !p.id) continue;
    if (!VALID_BTN_TYPES.includes(p.type)) continue;
    if (!Array.isArray(p.options) || p.options.length === 0) continue;
    const opts = p.options.filter(o => o && typeof o.label === 'string' && typeof o.value === 'string');
    if (opts.length === 0) continue;
    buttons.push({ id: p.id, type: p.type, prompt: typeof p.prompt === 'string' ? p.prompt : undefined, options: opts });
    cleanText = cleanText.replace(m[0], '');
  }
  return { cleanText: cleanText.trim(), buttons };
}

function parseBlocksFromText(text) {
  if (!text) return { cleanText: '', blocks: [] };
  const blocks = [];
  let cleanText = text;
  for (const { re, type, required } of BLOCK_PATTERNS) {
    re.lastIndex = 0;
    for (const m of [...text.matchAll(re)]) {
      let p;
      try { p = JSON.parse(m[1]); } catch { continue; }
      if (!p || typeof p !== 'object') continue;
      if (typeof p.id !== 'string' || !p.id) continue;
      if (required.some(k => p[k] == null)) continue;
      blocks.push({ blockType: type, ...p });
      cleanText = cleanText.replace(m[0], '');
    }
  }
  return { cleanText: cleanText.trim(), blocks };
}

function stripCommentsFromText(text) {
  if (!text) return text;
  return text.replace(SUGGESTIONS_RE, '').replace(CANVAS_CMD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
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
          <div className="chat-markdown" style={{ fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }} />
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

  const processedMessages = useMemo(() => {
    return messages.map(msg => {
      if (msg.role !== 'assistant' || msg._streaming) return msg;
      if (msg.buttons || msg.blocks) return msg;
      if (!msg.text) return msg;
      const hasComment = /<!--\s*(buttons|list|progress|card|code|steps|suggestions|canvas:)/.test(msg.text);
      if (!hasComment) return msg;
      const { cleanText: t1, buttons } = parseButtonsFromText(msg.text);
      const { cleanText: t2, blocks } = parseBlocksFromText(t1);
      const text = stripCommentsFromText(t2);
      const enriched = { ...msg, text };
      if (buttons.length > 0) enriched.buttons = buttons;
      if (blocks.length > 0) enriched.blocks = blocks;
      return enriched;
    });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processedMessages]);

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
      <style>{`
        .chat-markdown ol, .chat-markdown ul {
          padding-left: 1.5em;
          margin: 4px 0;
        }
        .chat-markdown ol { list-style-type: decimal; }
        .chat-markdown ul { list-style-type: disc; }
        .chat-markdown li { margin: 2px 0; }
        .chat-markdown li > ol, .chat-markdown li > ul { margin: 2px 0; }
        .chat-markdown p { margin: 4px 0; }
        .chat-markdown p:first-child { margin-top: 0; }
        .chat-markdown p:last-child { margin-bottom: 0; }
        .chat-markdown blockquote {
          border-left: 3px solid rgba(255,255,255,0.2);
          padding-left: 12px;
          margin: 6px 0;
          opacity: 0.85;
        }
      `}</style>
      <div style={styles.messages}>
        {processedMessages.map((msg, i) => {
          if (msg.role === 'user') {
            return <div key={i} style={styles.userMsg}>{msg.text}</div>;
          }
          if (msg.role === 'tool-use') {
            return <div key={i} style={styles.toolUse}>⚙ {msg.text || `Using ${msg.data?.toolName || 'tool'}`}</div>;
          }
          if (msg.role === 'assistant') {
            return (
              <div key={i} style={styles.assistantMsg}>
                <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
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
