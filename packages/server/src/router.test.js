import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventRouter } from './router.js';
import { createEnvelope, serializeEnvelope } from '@agora-agent/protocol';

function makeTierManager() {
  return { broadcastWs: vi.fn(), broadcastSse: vi.fn() };
}

describe('EventRouter', () => {
  let tm;
  let router;

  beforeEach(() => {
    tm = makeTierManager();
    router = new EventRouter(tm);
  });

  afterEach(() => {
    router.cancelWaiters();
  });

  describe('routeVisualCommand', () => {
    it('broadcasts envelope to WS and SSE', () => {
      const env = createEnvelope('canvas:diagram', { format: 'mermaid' }, 'bridge');
      router.routeVisualCommand(env);
      expect(tm.broadcastWs).toHaveBeenCalledTimes(1);
      expect(tm.broadcastSse).toHaveBeenCalledTimes(1);
      const data = JSON.stringify(env);
      expect(tm.broadcastWs).toHaveBeenCalledWith(data);
    });
  });

  describe('handleWsMessage', () => {
    it('routes event category messages to queue', () => {
      const msg = serializeEnvelope('event:click', { id: 'btn1' }, 'canvas');
      const { handled, error } = router.handleWsMessage(msg, 'c1');
      expect(handled).toBe(true);
      expect(error).toBeNull();
      expect(router.getQueueSize()).toBe(1);
    });

    it('routes canvas category messages to broadcast', () => {
      const msg = serializeEnvelope('canvas:diagram', { format: 'mermaid' }, 'canvas');
      router.handleWsMessage(msg, 'c1');
      expect(tm.broadcastWs).toHaveBeenCalledTimes(1);
    });

    it('routes chat category messages to onChatMessage handler', () => {
      const handler = vi.fn();
      router.onChatMessage = handler;
      const msg = serializeEnvelope('chat:send', { text: 'hi' }, 'canvas');
      router.handleWsMessage(msg, 'c1');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('chat:send');
    });

    it('ignores heartbeat messages', () => {
      const msg = serializeEnvelope('sys:heartbeat', {}, 'bridge');
      const { handled } = router.handleWsMessage(msg, 'c1');
      expect(handled).toBe(true);
      expect(router.getQueueSize()).toBe(0);
    });

    it('ignores sys:connect messages', () => {
      const msg = serializeEnvelope('sys:connect', {}, 'canvas');
      const { handled } = router.handleWsMessage(msg, 'c1');
      expect(handled).toBe(true);
      expect(router.getQueueSize()).toBe(0);
    });

    it('returns error for invalid JSON', () => {
      const { handled, error } = router.handleWsMessage('not-json', 'c1');
      expect(handled).toBe(false);
      expect(error).toBeTruthy();
    });
  });

  describe('handleRestEvent', () => {
    it('accepts valid envelope and enqueues', () => {
      const body = { v: 1, type: 'event:click', payload: { id: 'btn' }, source: 'plugin' };
      const { ok, error } = router.handleRestEvent(body);
      expect(ok).toBe(true);
      expect(error).toBeNull();
      expect(router.getQueueSize()).toBe(1);
    });

    it('rejects invalid envelope', () => {
      const { ok, error } = router.handleRestEvent({ bad: true });
      expect(ok).toBe(false);
      expect(error).toBeTruthy();
    });
  });

  describe('pollEvents', () => {
    it('returns queued events and clears queue', () => {
      router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '1' }, source: 'p' });
      router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '2' }, source: 'p' });
      const events = router.pollEvents();
      expect(events).toHaveLength(2);
      expect(router.getQueueSize()).toBe(0);
    });

    it('returns empty when waiters are active', () => {
      router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '1' }, source: 'p' });
      router.pollEventsAsync(5000);
      const events = router.pollEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('pollEventsAsync', () => {
    it('resolves immediately if events are queued', async () => {
      router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '1' }, source: 'p' });
      const events = await router.pollEventsAsync(1000);
      expect(events).toHaveLength(1);
    });

    it('resolves when event arrives', async () => {
      const promise = router.pollEventsAsync(5000);
      setTimeout(() => {
        router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '1' }, source: 'p' });
      }, 50);
      const events = await promise;
      expect(events).toHaveLength(1);
    });

    it('times out with empty array', async () => {
      const events = await router.pollEventsAsync(50);
      expect(events).toHaveLength(0);
    });
  });

  describe('cancelWaiters', () => {
    it('resolves all pending waiters with empty arrays', async () => {
      const p1 = router.pollEventsAsync(10000);
      const p2 = router.pollEventsAsync(10000);
      router.cancelWaiters();
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(0);
    });
  });

  describe('queue overflow', () => {
    it('drops oldest 10% when queue exceeds max', () => {
      router.maxQueueSize = 10;
      for (let i = 0; i < 11; i++) {
        router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: String(i) }, source: 'p' });
      }
      const events = router.pollEvents();
      expect(events.length).toBeLessThanOrEqual(11);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('enqueueTerminalEvent', () => {
    it('creates correct envelope and enqueues', () => {
      router.enqueueTerminalEvent({ command: 'ls', output: 'file.txt' });
      const events = router.pollEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('event:terminal-command');
      expect(events[0].payload.command).toBe('ls');
    });
  });

  describe('enqueuePtyEvent', () => {
    it('buffers and debounces PTY output', async () => {
      vi.useFakeTimers();
      router.enqueuePtyEvent('s1', 'hello');
      router.enqueuePtyEvent('s1', ' world');
      expect(router.getQueueSize()).toBe(0);
      vi.advanceTimersByTime(600);
      expect(router.getQueueSize()).toBe(1);
      const events = router.pollEvents();
      expect(events[0].type).toBe('event:pty-output');
      expect(events[0].payload.output).toBe('hello world');
      vi.useRealTimers();
    });
  });

  describe('peekEvents', () => {
    it('returns copy of queue without clearing', () => {
      router.handleRestEvent({ v: 1, type: 'event:click', payload: { id: '1' }, source: 'p' });
      const peeked = router.peekEvents();
      expect(peeked).toHaveLength(1);
      expect(router.getQueueSize()).toBe(1);
    });
  });
});
