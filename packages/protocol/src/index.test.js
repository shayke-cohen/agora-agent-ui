import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  createEnvelope,
  serializeEnvelope,
  parseEnvelope,
  isKnownType,
  isTypeInCategory,
  registerTypes,
  getMessageTypes,
  MSG_CANVAS_DIAGRAM,
  MSG_CHAT_SEND,
  MSG_SYS_CONNECT,
  TIER_FULL,
  TIER_CANVAS,
  TIER_TERMINAL,
  DEFAULT_PORT,
} from './index.js';

describe('protocol', () => {
  describe('createEnvelope', () => {
    it('creates a valid envelope', () => {
      const env = createEnvelope('canvas:diagram', { format: 'mermaid' }, 'bridge');
      expect(env.v).toBe(PROTOCOL_VERSION);
      expect(env.type).toBe('canvas:diagram');
      expect(env.payload.format).toBe('mermaid');
      expect(env.source).toBe('bridge');
      expect(typeof env.timestamp).toBe('number');
    });

    it('includes await when specified', () => {
      const env = createEnvelope('canvas:quiz', {}, 'plugin', {
        await: { event: 'event:quiz-answer', timeout: 60 },
      });
      expect(env.await.event).toBe('event:quiz-answer');
      expect(env.await.timeout).toBe(60);
    });

    it('defaults await timeout to 30', () => {
      const env = createEnvelope('canvas:quiz', {}, 'plugin', {
        await: { event: 'event:quiz-answer' },
      });
      expect(env.await.timeout).toBe(30);
    });
  });

  describe('serializeEnvelope', () => {
    it('returns valid JSON', () => {
      const json = serializeEnvelope('chat:send', { text: 'hi' }, 'canvas');
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('chat:send');
      expect(parsed.payload.text).toBe('hi');
    });
  });

  describe('parseEnvelope', () => {
    it('parses valid JSON string', () => {
      const json = JSON.stringify({ v: 1, type: 'chat:send', payload: { text: 'hi' }, source: 'canvas' });
      const { valid, envelope, error } = parseEnvelope(json);
      expect(valid).toBe(true);
      expect(envelope.type).toBe('chat:send');
      expect(error).toBeNull();
    });

    it('parses valid object', () => {
      const { valid } = parseEnvelope({ v: 1, type: 'test', payload: {}, source: 'test' });
      expect(valid).toBe(true);
    });

    it('rejects invalid JSON', () => {
      const { valid, error } = parseEnvelope('not json');
      expect(valid).toBe(false);
      expect(error).toBe('Invalid JSON');
    });

    it('rejects missing version', () => {
      const { valid } = parseEnvelope({ type: 'test', payload: {} });
      expect(valid).toBe(false);
    });

    it('rejects future protocol version', () => {
      const { valid } = parseEnvelope({ v: 999, type: 'test', payload: {} });
      expect(valid).toBe(false);
    });

    it('rejects missing payload', () => {
      const { valid } = parseEnvelope({ v: 1, type: 'test' });
      expect(valid).toBe(false);
    });
  });

  describe('type registry', () => {
    it('recognizes built-in types', () => {
      expect(isKnownType(MSG_CANVAS_DIAGRAM)).toBe(true);
      expect(isKnownType(MSG_CHAT_SEND)).toBe(true);
      expect(isKnownType(MSG_SYS_CONNECT)).toBe(true);
    });

    it('rejects unknown types', () => {
      expect(isKnownType('canvas:nonexistent')).toBe(false);
    });

    it('checks category membership', () => {
      expect(isTypeInCategory(MSG_CANVAS_DIAGRAM, 'canvas')).toBe(true);
      expect(isTypeInCategory(MSG_CANVAS_DIAGRAM, 'chat')).toBe(false);
    });

    it('allows registering custom types', () => {
      registerTypes({
        'canvas:my-dashboard': { category: 'canvas' },
        'event:my-custom': { category: 'event' },
      });
      expect(isKnownType('canvas:my-dashboard')).toBe(true);
      expect(isKnownType('event:my-custom')).toBe(true);
      expect(isTypeInCategory('canvas:my-dashboard', 'canvas')).toBe(true);
    });

    it('creates new categories for unknown ones', () => {
      registerTypes({ 'custom:thing': { category: 'custom' } });
      expect(isKnownType('custom:thing')).toBe(true);
      expect(isTypeInCategory('custom:thing', 'custom')).toBe(true);
    });
  });

  describe('getMessageTypes', () => {
    it('returns object with all categories', () => {
      const types = getMessageTypes();
      expect(types).toHaveProperty('canvas');
      expect(types).toHaveProperty('event');
      expect(types).toHaveProperty('chat');
      expect(types).toHaveProperty('session');
      expect(types).toHaveProperty('system');
      expect(Array.isArray(types.canvas)).toBe(true);
      expect(types.canvas.length).toBeGreaterThan(0);
    });
  });

  describe('parseEnvelope edge cases', () => {
    it('rejects null input', () => {
      const { valid, error } = parseEnvelope(null);
      expect(valid).toBe(false);
      expect(error).toBe('Envelope must be an object');
    });

    it('rejects numeric input', () => {
      const { valid, error } = parseEnvelope(123);
      expect(valid).toBe(false);
      expect(error).toBe('Envelope must be an object');
    });

    it('rejects non-object payload', () => {
      const { valid, error } = parseEnvelope({ v: 1, type: 'test', payload: 'string' });
      expect(valid).toBe(false);
      expect(error).toBe('Missing or invalid payload');
    });
  });

  describe('constants', () => {
    it('exports tier values', () => {
      expect(TIER_FULL).toBe(1);
      expect(TIER_CANVAS).toBe(2);
      expect(TIER_TERMINAL).toBe(3);
    });

    it('exports default port', () => {
      expect(DEFAULT_PORT).toBe(3456);
    });
  });
});
