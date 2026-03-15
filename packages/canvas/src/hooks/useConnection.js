/**
 * useConnection — WebSocket with SSE fallback for visual/event messages.
 * Handles sys:connect handshake, reconnection with exponential backoff.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const BRIDGE_URL = window.location.origin;

export function useConnection({ onMessage }) {
  const [connected, setConnected] = useState(false);
  const [tier, setTier] = useState(3);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const backoff = useRef(1000);

  const connect = useCallback(() => {
    const wsUrl = `${BRIDGE_URL.replace(/^http/, 'ws')}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        v: 1,
        type: 'sys:connect',
        payload: { clientType: 'canvas', protocolVersion: 1 },
        source: 'canvas',
        timestamp: Date.now(),
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'sys:connect') {
          setConnected(true);
          setTier(msg.payload?.tier || 2);
          backoff.current = 1000;
          return;
        }
        if (msg.type === 'sys:tier-change') {
          setTier(msg.payload?.newTier || 2);
          return;
        }
        if (msg.type === 'sys:heartbeat') return;
        if (onMessage) onMessage(msg);
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000);
        connect();
      }, backoff.current);
    };

    ws.onerror = () => ws.close();
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendEvent = useCallback((type, payload) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        v: 1, type, payload, source: 'canvas', timestamp: Date.now(),
      }));
    }
  }, []);

  return { connected, tier, sendEvent };
}
