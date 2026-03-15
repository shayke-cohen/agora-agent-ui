import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TierManager, generateClientId, validateHandshake } from './tier-manager.js';
import { TIER_FULL, TIER_CANVAS, TIER_TERMINAL } from '@agora-agent/protocol';

describe('generateClientId', () => {
  it('returns string starting with client-', () => {
    const id = generateClientId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^client-\d+-[a-z0-9]+$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateClientId()));
    expect(ids.size).toBe(50);
  });
});

describe('validateHandshake', () => {
  it('accepts valid canvas handshake', () => {
    const { valid, error } = validateHandshake({ clientType: 'canvas', protocolVersion: 1 });
    expect(valid).toBe(true);
    expect(error).toBeNull();
  });

  it('accepts valid extension handshake', () => {
    const { valid } = validateHandshake({ clientType: 'extension', protocolVersion: 1 });
    expect(valid).toBe(true);
  });

  it('rejects null payload', () => {
    const { valid, error } = validateHandshake(null);
    expect(valid).toBe(false);
    expect(error).toContain('object');
  });

  it('rejects invalid clientType', () => {
    const { valid, error } = validateHandshake({ clientType: 'unknown', protocolVersion: 1 });
    expect(valid).toBe(false);
    expect(error).toContain('clientType');
  });

  it('rejects missing protocolVersion', () => {
    const { valid, error } = validateHandshake({ clientType: 'canvas' });
    expect(valid).toBe(false);
    expect(error).toContain('protocolVersion');
  });

  it('rejects future protocolVersion', () => {
    const { valid, error } = validateHandshake({ clientType: 'canvas', protocolVersion: 999 });
    expect(valid).toBe(false);
    expect(error).toContain('Incompatible');
  });
});

describe('TierManager', () => {
  let tm;

  beforeEach(() => {
    tm = new TierManager();
  });

  it('starts at TIER_TERMINAL', () => {
    expect(tm.getTier()).toBe(TIER_TERMINAL);
  });

  it('becomes TIER_CANVAS when canvas client connects via WS', () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', mockWs, 'canvas');
    expect(tm.getTier()).toBe(TIER_CANVAS);
  });

  it('becomes TIER_CANVAS when canvas client connects via SSE', () => {
    const mockRes = { write: vi.fn() };
    tm.addSseClient('c1', mockRes, 'canvas');
    expect(tm.getTier()).toBe(TIER_CANVAS);
  });

  it('becomes TIER_FULL when extension + canvas connect', () => {
    const mockWs1 = { readyState: 1, send: vi.fn() };
    const mockWs2 = { readyState: 1, send: vi.fn() };
    tm.addWsClient('ext', mockWs1, 'extension');
    tm.addWsClient('cvs', mockWs2, 'canvas');
    expect(tm.getTier()).toBe(TIER_FULL);
  });

  it('drops back to TIER_TERMINAL when all clients disconnect', () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', mockWs, 'canvas');
    expect(tm.getTier()).toBe(TIER_CANVAS);
    tm.removeWsClient('c1');
    expect(tm.getTier()).toBe(TIER_TERMINAL);
  });

  it('drops from FULL to CANVAS when extension disconnects', () => {
    const ws1 = { readyState: 1, send: vi.fn() };
    const ws2 = { readyState: 1, send: vi.fn() };
    tm.addWsClient('ext', ws1, 'extension');
    tm.addWsClient('cvs', ws2, 'canvas');
    expect(tm.getTier()).toBe(TIER_FULL);
    tm.removeWsClient('ext');
    expect(tm.getTier()).toBe(TIER_CANVAS);
  });

  it('getTierInfo returns correct structure', () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', mockWs, 'canvas');
    const info = tm.getTierInfo();
    expect(info.tier).toBe(TIER_CANVAS);
    expect(info.label).toBe('Canvas Only');
    expect(info.clients.total).toBe(1);
    expect(info.clients.websocket).toEqual(['canvas']);
  });

  it('hasExtension returns correct boolean', () => {
    expect(tm.hasExtension()).toBe(false);
    const ws = { readyState: 1, send: vi.fn() };
    tm.addWsClient('ext', ws, 'extension');
    expect(tm.hasExtension()).toBe(true);
  });

  it('hasCanvas returns correct boolean', () => {
    expect(tm.hasCanvas()).toBe(false);
    const ws = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', ws, 'canvas');
    expect(tm.hasCanvas()).toBe(true);
  });

  it('broadcastWs sends to all WS clients', () => {
    const ws1 = { readyState: 1, send: vi.fn() };
    const ws2 = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', ws1, 'canvas');
    tm.addWsClient('c2', ws2, 'canvas');
    tm.broadcastWs('hello');
    expect(ws1.send).toHaveBeenCalledWith('hello');
    expect(ws2.send).toHaveBeenCalledWith('hello');
  });

  it('broadcastSse writes to all SSE clients', () => {
    const res1 = { write: vi.fn() };
    const res2 = { write: vi.fn() };
    tm.addSseClient('c1', res1, 'canvas');
    tm.addSseClient('c2', res2, 'canvas');
    tm.broadcastSse('hello');
    expect(res1.write).toHaveBeenCalledWith('data: hello\n\n');
    expect(res2.write).toHaveBeenCalledWith('data: hello\n\n');
  });

  it('broadcastWs skips clients with closed connections', () => {
    const ws1 = { readyState: 1, send: vi.fn() };
    const ws2 = { readyState: 3, send: vi.fn() };
    tm.addWsClient('c1', ws1, 'canvas');
    tm.addWsClient('c2', ws2, 'canvas');
    tm.broadcastWs('hello');
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).not.toHaveBeenCalled();
  });

  it('onTierChange listener fires on tier change', () => {
    const listener = vi.fn();
    tm.onTierChange(listener);
    const ws = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', ws, 'canvas');
    expect(listener).toHaveBeenCalledWith(TIER_TERMINAL, TIER_CANVAS);
  });

  it('onTierChange does not fire when tier stays the same', () => {
    const listener = vi.fn();
    const ws1 = { readyState: 1, send: vi.fn() };
    const ws2 = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', ws1, 'canvas');
    tm.onTierChange(listener);
    tm.addWsClient('c2', ws2, 'canvas');
    expect(listener).not.toHaveBeenCalled();
  });

  it('sendToClient sends via WS first, then SSE', () => {
    const ws = { readyState: 1, send: vi.fn() };
    tm.addWsClient('c1', ws, 'canvas');
    const sent = tm.sendToClient('c1', 'data');
    expect(sent).toBe(true);
    expect(ws.send).toHaveBeenCalledWith('data');
  });

  it('sendToClient returns false for unknown client', () => {
    expect(tm.sendToClient('unknown', 'data')).toBe(false);
  });

  it('removeSseClient removes client and recalculates tier', () => {
    const res = { write: vi.fn() };
    tm.addSseClient('c1', res, 'canvas');
    expect(tm.getTier()).toBe(TIER_CANVAS);
    tm.removeSseClient('c1');
    expect(tm.getTier()).toBe(TIER_TERMINAL);
  });
});
