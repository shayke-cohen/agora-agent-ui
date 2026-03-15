/**
 * SessionStore — persistent session storage for Agora.
 * One JSON file per session in the .agora-sessions/ directory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

const SESSION_DIR_NAME = '.agora-sessions';
const MAX_SESSIONS = 100;

let _sessionsDir = null;

export function getSessionsDir() {
  if (_sessionsDir) return _sessionsDir;
  _sessionsDir = resolve(process.cwd(), SESSION_DIR_NAME);
  ensureSessionsDir();
  return _sessionsDir;
}

export function setSessionsDir(dir) {
  _sessionsDir = dir;
  ensureSessionsDir();
}

function ensureSessionsDir() {
  if (!existsSync(_sessionsDir)) mkdirSync(_sessionsDir, { recursive: true });
  try {
    const gitignore = resolve(process.cwd(), '.gitignore');
    if (existsSync(gitignore)) {
      const content = readFileSync(gitignore, 'utf-8');
      if (!content.includes(SESSION_DIR_NAME)) {
        writeFileSync(gitignore, content.trimEnd() + '\n' + SESSION_DIR_NAME + '/\n');
      }
    }
  } catch { /* ignore */ }
}

function sessionPath(sessionId) { return join(getSessionsDir(), `${sessionId}.json`); }

function readSessionFile(sessionId) {
  const fp = sessionPath(sessionId);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return null; }
}

function writeSessionFile(sessionId, data) {
  const fp = sessionPath(sessionId);
  const tmp = fp + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, fp);
}

export function listSessions() {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const sessions = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      sessions.push({
        sessionId: data.sessionId,
        title: data.title || 'Untitled',
        tags: data.tags || null,
        created: data.created,
        lastActive: data.lastActive,
        pinned: data.pinned || false,
        messageCount: data.messageCount || 0,
        firstMessage: data.messages?.[0]?.text?.slice(0, 100) || null,
      });
    } catch { /* skip corrupt files */ }
  }
  sessions.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastActive) - new Date(a.lastActive);
  });
  return sessions;
}

export function getSession(sessionId) { return readSessionFile(sessionId); }

export function createSession(sessionId, meta = {}) {
  const now = new Date().toISOString();
  const session = {
    sessionId,
    title: meta.title || 'New conversation',
    tags: meta.tags || null,
    created: now,
    lastActive: now,
    pinned: false,
    messageCount: 0,
    messages: [],
  };
  writeSessionFile(sessionId, session);
  pruneOldSessions();
  return session;
}

export function appendMessage(sessionId, message) {
  let session = readSessionFile(sessionId);
  if (!session) session = createSession(sessionId);
  const msg = {
    id: message.id || `msg-${Date.now()}-${randomUUID().slice(0, 8)}`,
    role: message.role,
    text: message.text || null,
    data: message.data || null,
    timestamp: message.timestamp || Date.now(),
  };
  session.messages.push(msg);
  session.messageCount = session.messages.length;
  session.lastActive = new Date().toISOString();
  writeSessionFile(sessionId, session);
  return msg;
}

export function updateMeta(sessionId, fields) {
  const session = readSessionFile(sessionId);
  if (!session) return null;
  const allowed = ['title', 'tags', 'pinned'];
  for (const key of allowed) {
    if (fields[key] !== undefined) session[key] = fields[key];
  }
  session.lastActive = new Date().toISOString();
  writeSessionFile(sessionId, session);
  return session;
}

export function deleteSession(sessionId) {
  const fp = sessionPath(sessionId);
  if (existsSync(fp)) { unlinkSync(fp); return true; }
  return false;
}

export function purgeAll() {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) { try { unlinkSync(join(dir, file)); } catch { /* ignore */ } }
  return files.length;
}

export function generateTitle(text) {
  if (!text || typeof text !== 'string') return 'New conversation';
  const clean = text.replace(/[#*_`~]/g, '').replace(/[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]/g, '').trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const firstLine = lines[0] || 'New conversation';
  return firstLine.length <= 50 ? firstLine : firstLine.slice(0, 47) + '...';
}

function pruneOldSessions() {
  const sessions = listSessions();
  if (sessions.length <= MAX_SESSIONS) return;
  const unpinned = sessions.filter(s => !s.pinned);
  const toRemove = unpinned.slice(MAX_SESSIONS - sessions.filter(s => s.pinned).length);
  for (const s of toRemove) deleteSession(s.sessionId);
}
