import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnection } from './useConnection.js';

let wsInstances;

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sent = [];
    this._closed = false;
    wsInstances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() {
    if (this._closed) return;
    this._closed = true;
    this.readyState = 3;
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }
  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
}

describe('useConnection', () => {
  let originalWS;
  const stableOnMessage = vi.fn();

  beforeEach(() => {
    wsInstances = [];
    originalWS = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket;
    stableOnMessage.mockClear();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWS;
  });

  function getLatestWs() {
    return wsInstances[wsInstances.length - 1];
  }

  it('sends sys:connect handshake on open', () => {
    renderHook(() => useConnection({ onMessage: stableOnMessage }));
    const ws = getLatestWs();
    act(() => ws.simulateOpen());
    expect(ws.sent).toHaveLength(1);
    const msg = JSON.parse(ws.sent[0]);
    expect(msg.type).toBe('sys:connect');
    expect(msg.payload.clientType).toBe('canvas');
  });

  it('sets connected=true after handshake response', async () => {
    const { result } = renderHook(() => useConnection({ onMessage: stableOnMessage }));
    const ws = getLatestWs();

    await act(async () => {
      ws.simulateOpen();
    });

    await act(async () => {
      ws.simulateMessage({ type: 'sys:connect', payload: { tier: 2 } });
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.tier).toBe(2);
  });

  it('calls onMessage for non-system messages', async () => {
    renderHook(() => useConnection({ onMessage: stableOnMessage }));
    const ws = getLatestWs();

    await act(async () => {
      ws.simulateOpen();
    });
    await act(async () => {
      ws.simulateMessage({ type: 'sys:connect', payload: { tier: 2 } });
    });
    await act(async () => {
      ws.simulateMessage({ type: 'canvas:diagram', payload: { format: 'mermaid' } });
    });

    expect(stableOnMessage).toHaveBeenCalledTimes(1);
    expect(stableOnMessage.mock.calls[0][0].type).toBe('canvas:diagram');
  });

  it('ignores heartbeat messages', async () => {
    renderHook(() => useConnection({ onMessage: stableOnMessage }));
    const ws = getLatestWs();

    await act(async () => {
      ws.simulateOpen();
    });
    await act(async () => {
      ws.simulateMessage({ type: 'sys:heartbeat', payload: {} });
    });

    expect(stableOnMessage).not.toHaveBeenCalled();
  });

  it('sendEvent sends via WebSocket when connected', async () => {
    const { result } = renderHook(() => useConnection({ onMessage: stableOnMessage }));
    const ws = getLatestWs();

    await act(async () => {
      ws.simulateOpen();
    });
    await act(async () => {
      ws.simulateMessage({ type: 'sys:connect', payload: { tier: 2 } });
    });

    act(() => {
      result.current.sendEvent('event:click', { id: 'btn1' });
    });

    expect(ws.sent).toHaveLength(2);
    const sent = JSON.parse(ws.sent[1]);
    expect(sent.type).toBe('event:click');
    expect(sent.payload.id).toBe('btn1');
  });
});
