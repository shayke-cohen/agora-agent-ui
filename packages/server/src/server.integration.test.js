import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./mcp-bridge.js', () => ({
  bridgeMcpServers: async (mcpServers) => ({
    servers: mcpServers,
    cleanup: () => {},
  }),
}));

vi.mock('@shaykec/agent-web/server', () => ({
  createAgentServer: () => ({
    middleware: () => (req, res) => {
      if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      res.writeHead(404);
      res.end();
    },
    transport: {
      handleWsConnection: vi.fn(),
      startHeartbeat: vi.fn(),
    },
    sessions: {
      sendMessage: vi.fn().mockResolvedValue({}),
      stopSession: vi.fn().mockResolvedValue({}),
      closeSession: vi.fn().mockResolvedValue({}),
      closeAll: vi.fn().mockResolvedValue({}),
    },
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

let serverInstance;
let port;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Server Integration', () => {
  beforeAll(async () => {
    const { startServer } = await import('./server.js');
    port = 10000 + Math.floor(Math.random() * 50000);
    await new Promise(async (resolve) => {
      serverInstance = await startServer(
        {
          name: 'Test Agent',
          port,
          agent: { systemPrompt: 'Test prompt' },
          messageTypes: {
            'canvas:custom-viz': { category: 'canvas' },
            'event:custom-action': { category: 'event' },
          },
          endpoints: [
            {
              method: 'GET',
              path: '/api/custom',
              handler: (req, res) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ custom: true }));
              },
            },
            {
              method: 'GET',
              path: '/api/with-context',
              handler: (req, res, ctx) => {
                ctx.sendJson(200, {
                  hasTierManager: !!ctx.tierManager,
                  hasRouter: !!ctx.router,
                  hasSendJson: typeof ctx.sendJson === 'function',
                  hasReadBody: typeof ctx.readBody === 'function',
                  hasConfig: !!ctx.config,
                  tier: ctx.tierManager.getTier(),
                });
              },
            },
          ],
          canvas: {
            theme: 'dark',
            accent: '#ff6b6b',
            branding: { title: 'Test Bot' },
            welcome: {
              title: 'Welcome',
              subtitle: 'How can I help?',
              suggestions: [
                { label: 'Hello', text: 'Say hello' },
              ],
            },
            components: [
              { type: 'canvas:custom-viz', label: 'Custom Viz' },
            ],
          },
        },
        {
          onReady: () => {
            resolve();
          },
        },
      );
    });
  });

  afterAll(() => {
    if (serverInstance) serverInstance.close();
  });

  it('GET /health returns 200 with status, name, tier', async () => {
    const { status, data } = await request('GET', '/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.name).toBe('Test Agent');
    expect(data.tier).toBeDefined();
    expect(data.tier.tier).toBe(3);
    expect(data.tier.label).toBe('Terminal Only');
  });

  it('GET /api/tier returns tier info', async () => {
    const { status, data } = await request('GET', '/api/tier');
    expect(status).toBe(200);
    expect(data.tier).toBe(3);
    expect(data.clients).toBeDefined();
    expect(data.clients.total).toBe(0);
  });

  it('POST /api/event accepts valid envelope', async () => {
    const { status, data } = await request('POST', '/api/event', {
      v: 1,
      type: 'event:click',
      payload: { id: 'btn1' },
      source: 'plugin',
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/event rejects invalid envelope', async () => {
    const { status, data } = await request('POST', '/api/event', { bad: true });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it('GET /api/sessions returns session list', async () => {
    const { status, data } = await request('GET', '/api/sessions');
    expect(status).toBe(200);
    expect(data.sessions).toBeDefined();
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('POST /api/canvas routes visual command', async () => {
    const { status, data } = await request('POST', '/api/canvas', {
      v: 1,
      type: 'canvas:diagram',
      payload: { format: 'mermaid', content: 'flowchart TD\n  A --> B' },
      source: 'plugin',
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/canvas with await times out and returns null event', async () => {
    const { status, data } = await request('POST', '/api/canvas', {
      v: 1,
      type: 'canvas:quiz',
      payload: { question: 'test' },
      source: 'plugin',
      await: { event: 'event:quiz-answer', timeout: 1 },
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.event).toBeNull();
  });

  it('custom endpoints from config are reachable', async () => {
    const { status, data } = await request('GET', '/api/custom');
    expect(status).toBe(200);
    expect(data.custom).toBe(true);
  });

  it('GET /sse returns event stream with sys:connect', async () => {
    const result = await new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/sse`, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          if (buf.includes('sys:connect')) {
            req.destroy();
            resolve(buf);
          }
        });
        setTimeout(() => { req.destroy(); resolve(buf); }, 2000);
      });
      req.on('error', () => resolve(''));
    });
    expect(result).toContain('sys:connect');
    expect(result).toContain('data:');
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const { status, headers } = await request('OPTIONS', '/api/tier');
    expect(status).toBe(204);
    expect(headers['access-control-allow-origin']).toBe('*');
  });

  it('unknown path returns 404', async () => {
    const { status } = await request('GET', '/nonexistent');
    expect(status).toBe(404);
  });

  // Phase 2: /api/config endpoint
  it('GET /api/config returns canvas configuration', async () => {
    const { status, data } = await request('GET', '/api/config');
    expect(status).toBe(200);
    expect(data.name).toBe('Test Agent');
    expect(data.theme).toBe('dark');
    expect(data.accent).toBe('#ff6b6b');
    expect(data.branding.title).toBe('Test Bot');
    expect(data.welcome.title).toBe('Welcome');
    expect(data.welcome.suggestions).toHaveLength(1);
    expect(data.welcome.suggestions[0].label).toBe('Hello');
  });

  it('GET /api/config includes custom component types', async () => {
    const { data } = await request('GET', '/api/config');
    expect(data.components).toHaveLength(1);
    expect(data.components[0].type).toBe('canvas:custom-viz');
    expect(data.components[0].label).toBe('Custom Viz');
  });

  // Phase 2: endpoint helpers (context injection)
  it('custom endpoints receive context with helpers', async () => {
    const { status, data } = await request('GET', '/api/with-context');
    expect(status).toBe(200);
    expect(data.hasTierManager).toBe(true);
    expect(data.hasRouter).toBe(true);
    expect(data.hasSendJson).toBe(true);
    expect(data.hasReadBody).toBe(true);
    expect(data.hasConfig).toBe(true);
    expect(data.tier).toBe(3);
  });

  // Phase 2: type registration
  it('custom message types are registered at startup', async () => {
    const { isKnownType, isTypeInCategory } = await import('@agora-agent/protocol');
    expect(isKnownType('canvas:custom-viz')).toBe(true);
    expect(isTypeInCategory('canvas:custom-viz', 'canvas')).toBe(true);
    expect(isKnownType('event:custom-action')).toBe(true);
    expect(isTypeInCategory('event:custom-action', 'event')).toBe(true);
  });
});

describe('ensureClaudeMd', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agora-claudemd-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates CLAUDE.md when missing', async () => {
    const { ensureClaudeMd } = await import('./server.js');
    const result = ensureClaudeMd({ name: 'TestBot' });
    expect(result).toBe(true);
    expect(existsSync(join(tempDir, 'CLAUDE.md'))).toBe(true);
    const content = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# TestBot');
    expect(content).toContain('agora-canvas');
    expect(content).toContain('canvas:html');
  });

  it('uses default name when config.name is not set', async () => {
    const { ensureClaudeMd } = await import('./server.js');
    ensureClaudeMd({});
    const content = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# Agora Agent');
  });

  it('does not overwrite existing CLAUDE.md', async () => {
    const { writeFileSync: wfs } = await import('fs');
    wfs(join(tempDir, 'CLAUDE.md'), '# Custom content');
    const { ensureClaudeMd } = await import('./server.js');
    const result = ensureClaudeMd({ name: 'TestBot' });
    expect(result).toBe(false);
    const content = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe('# Custom content');
  });
});
