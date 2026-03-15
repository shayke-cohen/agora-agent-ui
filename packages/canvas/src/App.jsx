/**
 * Agora Canvas App — fixed chat shell + composable visual panel.
 *
 * The chat panel, connection layer, and layout engine are framework-owned.
 * The visual panel renders whatever component is registered for the current message type.
 * Config (theme, branding, welcome) is loaded from the bridge server at startup.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ClaudeProvider, useChat, useSessions } from '@shaykec/agent-web/react';
import { useConnection } from './hooks/useConnection.js';
import { useConfig } from './hooks/useConfig.js';
import Chat from './components/Chat.jsx';
import { getComponents, hasComponent } from './componentRegistry.js';

const BRIDGE_URL = window.location.origin;
const CHAT_URL = `${BRIDGE_URL}/api`;

const LAYOUT = { chat: 'chat', visual: 'visual', split: 'split' };

const DEFAULT_THEME = {
  background: '#0d1117',
  surface: '#161b22',
  border: '#21262d',
  text: '#c9d1d9',
  accent: '#58a6ff',
  success: '#3fb950',
  error: '#f85149',
};

function buildTheme(config) {
  if (!config) return DEFAULT_THEME;
  return {
    ...DEFAULT_THEME,
    accent: config.accent || DEFAULT_THEME.accent,
  };
}

function AppInner() {
  const chat = useChat();
  const sessions = useSessions();
  const { config } = useConfig();

  const [layout, setLayout] = useState(LAYOUT.chat);
  const [visualMode, setVisualMode] = useState(null);
  const [visualData, setVisualData] = useState(null);
  const [suggestions, setSuggestions] = useState(() => {
    return [];
  });
  const [chatWidth, setChatWidth] = useState(() => parseInt(localStorage.getItem('agora-chat-width') || '420'));

  const components = getComponents();
  const theme = buildTheme(config);
  const branding = config?.branding || { title: 'Agora' };

  useEffect(() => {
    if (config?.welcome?.suggestions && suggestions.length === 0) {
      setSuggestions(config.welcome.suggestions);
    }
  }, [config]);

  const resizing = useRef(false);

  const handleVisualMessage = useCallback((msg) => {
    if (msg.type === 'chat:suggestions') {
      setSuggestions(msg.payload?.suggestions || []);
      return;
    }

    if (msg.type?.startsWith('canvas:')) {
      if (hasComponent(msg.type)) {
        setVisualMode(msg.type);
        setVisualData(msg.payload);
        setLayout(LAYOUT.split);
      }
    }
  }, []);

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
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: theme.background }}>
      {/* Status bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '36px', background: theme.surface, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 100, justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>{branding.title || 'Agora'}</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {layout === LAYOUT.split && (
            <button onClick={() => setLayout(LAYOUT.chat)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '12px' }}>
              Close panel
            </button>
          )}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? theme.success : theme.error }} title={connected ? 'Connected' : 'Disconnected'} />
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
            style={{ width: '4px', cursor: 'col-resize', background: theme.border, flexShrink: 0 }}
          />
        )}

        {/* Visual panel */}
        {layout === LAYOUT.split && VisualComponent && (
          <div style={{ flex: 1, minWidth: '300px', background: theme.background, overflow: 'hidden' }}>
            <VisualComponent
              payload={visualData}
              sendEvent={sendEvent}
              sendChat={handleSend}
              theme={theme}
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
