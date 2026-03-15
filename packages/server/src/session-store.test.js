import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  setSessionsDir,
  createSession,
  listSessions,
  getSession,
  appendMessage,
  updateMeta,
  deleteSession,
  purgeAll,
  generateTitle,
} from './session-store.js';

describe('SessionStore', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agora-test-'));
    setSessionsDir(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('creates a session and returns session object', () => {
      const session = createSession('test-1');
      expect(session.sessionId).toBe('test-1');
      expect(session.title).toBe('New conversation');
      expect(session.messageCount).toBe(0);
      expect(session.messages).toEqual([]);
      expect(session.pinned).toBe(false);
      expect(session.created).toBeTruthy();
      expect(session.lastActive).toBeTruthy();
    });

    it('creates a session with custom meta', () => {
      const session = createSession('test-2', { title: 'My Chat', tags: ['test'] });
      expect(session.title).toBe('My Chat');
      expect(session.tags).toEqual(['test']);
    });

    it('persists session to disk', () => {
      createSession('test-3');
      const loaded = getSession('test-3');
      expect(loaded).not.toBeNull();
      expect(loaded.sessionId).toBe('test-3');
    });
  });

  describe('listSessions', () => {
    it('returns empty list initially', () => {
      expect(listSessions()).toEqual([]);
    });

    it('lists all created sessions', () => {
      createSession('a');
      createSession('b');
      createSession('c');
      const list = listSessions();
      expect(list).toHaveLength(3);
      const ids = list.map(s => s.sessionId).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('sorts pinned sessions first', () => {
      createSession('a');
      createSession('b');
      updateMeta('a', { pinned: true });
      const list = listSessions();
      expect(list[0].sessionId).toBe('a');
      expect(list[0].pinned).toBe(true);
    });
  });

  describe('getSession', () => {
    it('returns full session with messages', () => {
      createSession('s1');
      appendMessage('s1', { role: 'user', text: 'Hello' });
      const session = getSession('s1');
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].text).toBe('Hello');
    });

    it('returns null for missing session', () => {
      expect(getSession('nonexistent')).toBeNull();
    });
  });

  describe('appendMessage', () => {
    it('adds message and increments messageCount', () => {
      createSession('s1');
      const msg = appendMessage('s1', { role: 'user', text: 'Hi' });
      expect(msg.role).toBe('user');
      expect(msg.text).toBe('Hi');
      expect(msg.id).toBeTruthy();
      const session = getSession('s1');
      expect(session.messageCount).toBe(1);
    });

    it('auto-creates session if missing', () => {
      appendMessage('new-session', { role: 'user', text: 'First' });
      const session = getSession('new-session');
      expect(session).not.toBeNull();
      expect(session.messageCount).toBe(1);
    });

    it('appends multiple messages', () => {
      createSession('s1');
      appendMessage('s1', { role: 'user', text: 'One' });
      appendMessage('s1', { role: 'assistant', text: 'Two' });
      appendMessage('s1', { role: 'user', text: 'Three' });
      const session = getSession('s1');
      expect(session.messageCount).toBe(3);
    });
  });

  describe('updateMeta', () => {
    it('updates allowed fields', () => {
      createSession('s1');
      const updated = updateMeta('s1', { title: 'New Title', pinned: true });
      expect(updated.title).toBe('New Title');
      expect(updated.pinned).toBe(true);
    });

    it('updates tags', () => {
      createSession('s1');
      const updated = updateMeta('s1', { tags: ['a', 'b'] });
      expect(updated.tags).toEqual(['a', 'b']);
    });

    it('ignores unknown fields', () => {
      createSession('s1');
      const updated = updateMeta('s1', { title: 'OK', unknown: 'bad' });
      expect(updated.title).toBe('OK');
      expect(updated.unknown).toBeUndefined();
    });

    it('returns null for missing session', () => {
      expect(updateMeta('nonexistent', { title: 'X' })).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('removes session and returns true', () => {
      createSession('s1');
      expect(deleteSession('s1')).toBe(true);
      expect(getSession('s1')).toBeNull();
    });

    it('returns false for missing session', () => {
      expect(deleteSession('nonexistent')).toBe(false);
    });
  });

  describe('purgeAll', () => {
    it('removes all sessions and returns count', () => {
      createSession('s1');
      createSession('s2');
      createSession('s3');
      const count = purgeAll();
      expect(count).toBe(3);
      expect(listSessions()).toHaveLength(0);
    });

    it('returns 0 when no sessions exist', () => {
      expect(purgeAll()).toBe(0);
    });
  });

  describe('generateTitle', () => {
    it('returns short text as-is', () => {
      expect(generateTitle('Hello world')).toBe('Hello world');
    });

    it('truncates long text to 50 chars', () => {
      const long = 'A'.repeat(100);
      const title = generateTitle(long);
      expect(title.length).toBeLessThanOrEqual(50);
      expect(title).toContain('...');
    });

    it('returns default for null input', () => {
      expect(generateTitle(null)).toBe('New conversation');
    });

    it('returns default for empty string', () => {
      expect(generateTitle('')).toBe('New conversation');
    });

    it('strips markdown formatting', () => {
      expect(generateTitle('# Hello **world**')).toBe('Hello world');
    });
  });

  describe('pruning', () => {
    it('prunes oldest unpinned sessions when exceeding max', () => {
      for (let i = 0; i < 105; i++) {
        createSession(`s-${String(i).padStart(3, '0')}`);
      }
      const sessions = listSessions();
      expect(sessions.length).toBeLessThanOrEqual(100);
    });
  });
});
