/**
 * Event routing for Agora bridge server.
 * Visual commands fan out to connected clients.
 * User events are queued for the agent to poll.
 */

import {
  parseEnvelope, isTypeInCategory, createEnvelope,
  MSG_SYS_HEARTBEAT, MSG_SYS_CONNECT, MSG_SYS_DISCONNECT,
  MSG_EVENT_TERMINAL_COMMAND, MSG_EVENT_PTY_OUTPUT,
} from '@agora-agent/protocol';

export class EventRouter {
  constructor(tierManager) {
    this.tierManager = tierManager;
    this.eventQueue = [];
    this.maxQueueSize = 1000;
    this._waiters = [];
    this.onChatMessage = null;
  }

  routeVisualCommand(envelope) {
    const data = JSON.stringify(envelope);
    this.tierManager.broadcastWs(data);
    this.tierManager.broadcastSse(data);
  }

  handleWsMessage(rawData, clientId) {
    const { valid, envelope, error } = parseEnvelope(rawData);
    if (!valid) return { handled: false, error };

    if (envelope.type === MSG_SYS_HEARTBEAT || envelope.type === MSG_SYS_CONNECT || envelope.type === MSG_SYS_DISCONNECT) {
      return { handled: true, error: null };
    }

    if (isTypeInCategory(envelope.type, 'event') || isTypeInCategory(envelope.type, 'capture') || isTypeInCategory(envelope.type, 'context')) {
      this._enqueueEvent(envelope);
      return { handled: true, error: null };
    }

    if (isTypeInCategory(envelope.type, 'canvas')) {
      this.routeVisualCommand(envelope);
      return { handled: true, error: null };
    }

    if (isTypeInCategory(envelope.type, 'chat')) {
      if (this.onChatMessage) this.onChatMessage(envelope);
      return { handled: true, error: null };
    }

    return { handled: true, error: null };
  }

  handleRestEvent(body) {
    const { valid, envelope, error } = parseEnvelope(body);
    if (!valid) return { ok: false, error };
    this._enqueueEvent(envelope);
    return { ok: true, error: null };
  }

  pollEvents() {
    if (this._waiters.length > 0) return [];
    const events = this.eventQueue.slice();
    this.eventQueue = [];
    return events;
  }

  peekEvents() { return this.eventQueue.slice(); }
  getQueueSize() { return this.eventQueue.length; }

  pollEventsAsync(timeoutMs) {
    if (this.eventQueue.length > 0) return Promise.resolve(this.pollEvents());
    return new Promise((resolve) => {
      const waiter = { resolve: null, timer: null };
      waiter.timer = setTimeout(() => { this._removeWaiter(waiter); resolve([]); }, timeoutMs);
      waiter.resolve = (events) => { clearTimeout(waiter.timer); resolve(events); };
      this._waiters.push(waiter);
    });
  }

  cancelWaiters() {
    const waiters = this._waiters.splice(0);
    for (const w of waiters) { clearTimeout(w.timer); w.resolve([]); }
  }

  enqueueTerminalEvent(data) {
    this._enqueueEvent(createEnvelope(MSG_EVENT_TERMINAL_COMMAND, data, 'bridge'));
  }

  enqueuePtyEvent(sessionId, data) {
    if (!this._ptyBuffers) this._ptyBuffers = new Map();
    if (!this._ptyTimers) this._ptyTimers = new Map();
    const existing = this._ptyBuffers.get(sessionId) || '';
    this._ptyBuffers.set(sessionId, existing + data);
    if (!this._ptyTimers.has(sessionId)) {
      this._ptyTimers.set(sessionId, setTimeout(() => {
        const buffered = this._ptyBuffers.get(sessionId) || '';
        this._ptyBuffers.delete(sessionId);
        this._ptyTimers.delete(sessionId);
        if (buffered) this._enqueueEvent(createEnvelope(MSG_EVENT_PTY_OUTPUT, { sessionId, output: buffered }, 'bridge'));
      }, 500));
    }
  }

  _notifyWaiters() {
    if (this._waiters.length === 0) return;
    const events = this.eventQueue.slice();
    this.eventQueue = [];
    const waiters = this._waiters.splice(0);
    for (const w of waiters) w.resolve(events);
  }

  _removeWaiter(waiter) {
    const idx = this._waiters.indexOf(waiter);
    if (idx !== -1) this._waiters.splice(idx, 1);
  }

  _enqueueEvent(envelope) {
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(Math.floor(this.maxQueueSize * 0.1));
    }
    this.eventQueue.push(envelope);
    this._notifyWaiters();
  }
}
