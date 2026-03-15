/**
 * Agora Canvas App — fixed chat shell + composable visual panel.
 *
 * The chat panel, connection layer, and layout engine are framework-owned.
 * The visual panel renders whatever component is registered for the current message type.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ClaudeProvider, useChat, useSessions } from '@shaykec/agent-web/react';
import { useConnection } from './hooks/useConnection.js';
import Chat from './components/Chat.jsx';
import defaultComponents from './defaultComponents.js';

const BRIDGE_URL = window.location.origin;
const CHAT_URL = `${BRIDGE_URL}/api`;

const LAYOUT = { chat: 'chat', visual: 'visual', split: 'split' };

function AppInner() {
  const chat = useChat();
  const sessions = useSessions();

  const [layout, setLayout] = useState(LAYOUT.chat);
  const [visualMode, setVisualMode] = useState(null);
  const [visualData, setVisualData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [chatWidth, setChatWidth] = useState(() => parseInt(localStorage.getItem('agora-chat-width') || '420'));
  const [components] = useState(defaultComponents);

  const resizing = useRef(false);

  const handleVisualMessage = useCallback((msg) => {
    if (msg.type === 'chat:suggestions') {
      setSuggestions(msg.payload?.suggestions || []);
      return;
    }

    if (msg.type?.startsWith('canvas:')) {
      if (components[msg.type]) {
        setVisualMode(msg.type);
        setVisualData(msg.payload);
        setLayout(LAYOUT.split);
      }
    }
  }, [components]);

  const { connected, tier, sendEvent } = useConnection({ onMessage: handleVisualMessage });

  const handleChatMessage = useCallback((msg) => {
    if (msg.type === 'chat:assistant' && msg.payload?.text) {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const handleVisualFromChat = (msg) => {
      handleVisualMessage(msg);
      handleChatMessage(msg);
    };
    return () => {};
  }, [handleVisualMessage, handleChatMessage]);

  const handleSend = useCallback((text) => {
    setSuggestions([]);
    chat.send(text);
  }, [chat]);

  const messages = (chat.messages || []).map(m => ({
    role: m.role === 'human' ? 'user' : m.role,
    text: m.content?.[0]?.text || m.text || '',
    buttons: m.buttons,
    blocks: m.blocks,
    data: m.data,
  }));

  const handleMouseDown = useCallback(() => { resizing.current = true; }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing.current) return;
      const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth - 300));
      setChatWidth(newWidth);
      localStorage.setItem('agora-chat-width', String(newWidth));
    };
    const handleMouseUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  const VisualComponent = visualMode ? components[visualMode] : null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0d1117' }}>
      {/* Status bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '36px', background: '#161b22', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 100, justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#c9d1d9' }}>Agora</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {layout === LAYOUT.split && (
            <button onClick={() => setLayout(LAYOUT.chat)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '12px' }}>
              Close panel
            </button>
          )}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#3fb950' : '#f85149' }} title={connected ? 'Connected' : 'Disconnected'} />
        </div>
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, marginTop: '36px' }}>
        {/* Chat panel */}
        <div style={{ width: layout === LAYOUT.split ? `${chatWidth}px` : '100%', minWidth: '300px', transition: layout === LAYOUT.split ? 'none' : 'width 0.2s' }}>
          <Chat
            messages={messages}
            onSend={handleSend}
            onStop={() => chat.stop()}
            isStreaming={chat.isStreaming}
            suggestions={suggestions}
          />
        </div>

        {/* Resize handle */}
        {layout === LAYOUT.split && (
          <div
            onMouseDown={handleMouseDown}
            style={{ width: '4px', cursor: 'col-resize', background: '#21262d', flexShrink: 0 }}
          />
        )}

        {/* Visual panel */}
        {layout === LAYOUT.split && VisualComponent && (
          <div style={{ flex: 1, minWidth: '300px', background: '#0d1117', overflow: 'hidden' }}>
            <VisualComponent
              payload={visualData}
              sendEvent={sendEvent}
              sendChat={handleSend}
              theme={{ background: '#0d1117', surface: '#161b22', border: '#21262d', text: '#c9d1d9', accent: '#58a6ff' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ClaudeProvider url={CHAT_URL}>
      <AppInner />
    </ClaudeProvider>
  );
}
