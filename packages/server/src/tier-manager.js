/**
 * Client connection tracker and tier negotiation for Agora bridge server.
 */

import {
  TIER_FULL, TIER_CANVAS, TIER_TERMINAL, TIER_LABELS,
  CLIENT_EXTENSION, CLIENT_CANVAS, HEARTBEAT_INTERVAL_MS,
  PROTOCOL_VERSION, createEnvelope, MSG_SYS_TIER_CHANGE, MSG_SYS_HEARTBEAT,
} from '@agora-agent/protocol';

export class TierManager {
  constructor() {
    this.wsClients = new Map();
    this.sseClients = new Map();
    this.currentTier = TIER_TERMINAL;
    this._listeners = [];
    this._heartbeatInterval = null;
  }

  startHeartbeat() {
    this._heartbeatInterval = setInterval(() => this.broadcastHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  addWsClient(id, ws, clientType) {
    this.wsClients.set(id, { ws, clientType, connectedAt: Date.now() });
    this._recalculateTier();
  }

  addSseClient(id, res, clientType) {
    this.sseClients.set(id, { res, clientType, connectedAt: Date.now() });
    this._recalculateTier();
  }

  removeWsClient(id) {
    this.wsClients.delete(id);
    this._recalculateTier();
  }

  removeSseClient(id) {
    this.sseClients.delete(id);
    this._recalculateTier();
  }

  getTier() { return this.currentTier; }

  getTierInfo() {
    const wsClientTypes = [...this.wsClients.values()].map(c => c.clientType);
    const sseClientTypes = [...this.sseClients.values()].map(c => c.clientType);
    return {
      tier: this.currentTier,
      label: TIER_LABELS[this.currentTier],
      clients: { websocket: wsClientTypes, sse: sseClientTypes, total: this.wsClients.size + this.sseClients.size },
    };
  }

  hasExtension() {
    for (const [, c] of this.wsClients) if (c.clientType === CLIENT_EXTENSION) return true;
    return false;
  }

  hasCanvas() {
    for (const [, c] of this.wsClients) if (c.clientType === CLIENT_CANVAS) return true;
    for (const [, c] of this.sseClients) if (c.clientType === CLIENT_CANVAS) return true;
    return false;
  }

  onTierChange(fn) { this._listeners.push(fn); }

  broadcastHeartbeat() {
    const msg = JSON.stringify(createEnvelope(MSG_SYS_HEARTBEAT, {}, 'bridge'));
    this.broadcastWs(msg);
    this.broadcastSse(msg);
  }

  sendToClient(clientId, data) {
    return this.sendToWsClient(clientId, data) || this.sendToSseClient(clientId, data);
  }

  sendToWsClient(clientId, data) {
    const client = this.wsClients.get(clientId);
    if (client && client.ws.readyState === 1) {
      try { client.ws.send(data); return true; } catch { return false; }
    }
    return false;
  }

  sendToSseClient(clientId, data) {
    const client = this.sseClients.get(clientId);
    if (client) {
      try { client.res.write(`data: ${data}\n\n`); return true; } catch { return false; }
    }
    return false;
  }

  broadcastWs(data) {
    for (const [, c] of this.wsClients) {
      try { if (c.ws.readyState === 1) c.ws.send(data); } catch { /* ignore */ }
    }
  }

  broadcastSse(data) {
    for (const [, c] of this.sseClients) {
      try { c.res.write(`data: ${data}\n\n`); } catch { /* ignore */ }
    }
  }

  _recalculateTier() {
    const oldTier = this.currentTier;
    let newTier;
    if (this.hasExtension() && this.hasCanvas()) newTier = TIER_FULL;
    else if (this.hasCanvas()) newTier = TIER_CANVAS;
    else newTier = TIER_TERMINAL;

    this.currentTier = newTier;
    if (oldTier !== newTier) {
      const msg = JSON.stringify(createEnvelope(MSG_SYS_TIER_CHANGE, { oldTier, newTier }, 'bridge'));
      this.broadcastWs(msg);
      this.broadcastSse(msg);
      for (const fn of this._listeners) { try { fn(oldTier, newTier); } catch { /* ignore */ } }
    }
  }
}

export function generateClientId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validateHandshake(payload) {
  if (!payload || typeof payload !== 'object') return { valid: false, error: 'Handshake payload must be an object' };
  const { clientType, protocolVersion } = payload;
  if (clientType !== CLIENT_EXTENSION && clientType !== CLIENT_CANVAS) return { valid: false, error: `Invalid clientType: ${clientType}` };
  if (typeof protocolVersion !== 'number') return { valid: false, error: 'Missing protocolVersion' };
  if (protocolVersion > PROTOCOL_VERSION) return { valid: false, error: `Incompatible protocol version: ${protocolVersion}` };
  return { valid: true, error: null };
}
