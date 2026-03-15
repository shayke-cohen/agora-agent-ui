/**
 * Agora Bridge Server — configurable HTTP + WebSocket + SSE hub.
 *
 * The server is generic: system prompt, tools, plugins, custom endpoints,
 * and custom interceptors are all provided via the config object.
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import {
  PROTOCOL_VERSION, parseEnvelope, createEnvelope, serializeEnvelope,
  MSG_SYS_CONNECT, DEFAULT_PORT, MAX_LONG_POLL_TIMEOUT_MS,
  PLAYGROUND_EXEC_TIMEOUT_MS, PLAYGROUND_MAX_OUTPUT_BYTES,
  registerTypes,
} from '@agora-agent/protocol';

import { TierManager, generateClientId, validateHandshake } from './tier-manager.js';
import { EventRouter } from './router.js';
import {
  extractAndRouteVisuals, extractAndRouteMedia, extractAndRouteSuggestions,
  extractButtons, extractInlineBlocks, runCustomInterceptors,
  stripCanvasCommands, enhanceWithSmartComponents,
} from './visual-interceptor.js';
import { createAgentServer } from '@shaykec/agent-web/server';
import {
  listSessions as listStoredSessions, getSession as getStoredSession,
  appendMessage as appendStoredMessage, updateMeta as updateStoredMeta,
  deleteSession as deleteStoredSession, purgeAll as purgeStoredSessions,
  generateTitle,
} from './session-store.js';
import { bridgeMcpServers } from './mcp-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};

/**
 * Load an agora.config.js file and return the config object.
 * @param {string} configPath - Absolute path to agora.config.js
 * @returns {Promise<object>}
 */
export async function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    return { name: 'Agora Agent', agent: {}, canvas: {} };
  }
  const mod = await import(configPath);
  return mod.default || mod;
}

/**
 * Start the Agora bridge server.
 * @param {object} config - Loaded agora.config.js
 * @param {object} [options] - Runtime options
 * @param {string} [options.canvasDist] - Path to built canvas static files
 * @param {function} [options.onReady] - Callback when server is listening
 * @param {function} [options.onTierChange] - Callback(oldTier, newTier)
 */
export async function startServer(config = {}, options = {}) {
  const port = config.port || DEFAULT_PORT;
  const tierManager = new TierManager();
  const router = new EventRouter(tierManager);

  if (config.messageTypes) {
    registerTypes(config.messageTypes);
  }

  ensureClaudeMd(config);

  const agentConfig = {
    cwd: process.cwd(),
    systemPrompt: buildSystemPrompt(config),
    tools: config.agent?.tools || ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: config.agent?.permissionMode || 'bypassPermissions',
    settingSources: ['user', 'project'],
  };

  if (config.plugins && config.plugins.length > 0) {
    agentConfig.plugins = config.plugins;
  }

  // Bridge MCP servers: convert stdio configs to in-process SDK servers
  let mcpCleanup = () => {};
  if (config.agent?.mcpServers && Object.keys(config.agent.mcpServers).length > 0) {
    const { servers, cleanup } = await bridgeMcpServers(config.agent.mcpServers);
    mcpCleanup = cleanup;
    if (Object.keys(servers).length > 0) {
      agentConfig.mcpServers = servers;
      console.log(`  MCP servers ready: ${Object.keys(servers).join(', ')}`);
    }
  }

  const autoRoutedMediaUrls = new Set();
  const sessionTitleSet = new Set();
  const customInterceptors = config.interceptors || [];

  const agentServer = createAgentServer({
    basePath: '/api',
    config: agentConfig,
    hooks: {
      onMessage: (envelope) => {
        if (envelope.type === 'chat:assistant' && envelope.payload?.text) {
          envelope.payload.text = enhanceWithSmartComponents(envelope.payload.text);

          const { cleanText, buttons } = extractButtons(envelope.payload.text);
          if (buttons.length > 0) {
            envelope.payload.text = cleanText;
            envelope.payload.buttons = buttons;
          }
          const { cleanText: text2, blocks } = extractInlineBlocks(envelope.payload.text);
          if (blocks.length > 0) {
            envelope.payload.text = text2;
            envelope.payload.blocks = blocks;
          }
        }

        if (envelope.type === 'chat:assistant' && envelope.payload?.text) {
          const rawText = envelope.payload.text;
          extractAndRouteVisuals(rawText, tierManager, router);
          extractAndRouteMedia(rawText, router, autoRoutedMediaUrls);
          extractAndRouteSuggestions(rawText, tierManager);
          runCustomInterceptors(rawText, customInterceptors, router);
          envelope.payload.text = stripCanvasCommands(envelope.payload.text);
        }

        const data = JSON.stringify(envelope);
        tierManager.broadcastWs(data);
        tierManager.broadcastSse(data);

        const sid = envelope.sessionId || envelope.payload?.sessionId;
        if (sid) {
          try {
            if (envelope.type === 'chat:assistant' && envelope.payload?.text) {
              appendStoredMessage(sid, { role: 'assistant', text: envelope.payload.text, timestamp: envelope.timestamp || Date.now() });
              if (!sessionTitleSet.has(sid)) {
                sessionTitleSet.add(sid);
                updateStoredMeta(sid, { title: generateTitle(envelope.payload.text) });
              }
            } else if (envelope.type === 'chat:tool-use') {
              const tn = envelope.payload?.toolName || 'tool';
              console.log(`  [tool-use] ${tn}`);
              appendStoredMessage(sid, { role: 'tool-use', text: `Using ${tn}`, data: envelope.payload, timestamp: envelope.timestamp || Date.now() });
            } else if (envelope.type === 'chat:tool-result') {
              appendStoredMessage(sid, { role: 'tool-result', data: envelope.payload, timestamp: envelope.timestamp || Date.now() });
            }
          } catch { /* don't break chat flow */ }
        }
      },
    },
  });

  const chatMiddleware = agentServer.middleware();

  const sm = agentServer.sessions;
  const origSend = sm.sendMessage.bind(sm);
  sm.sendMessage = function(sessionId, text) {
    try {
      appendStoredMessage(sessionId, { role: 'user', text, timestamp: Date.now() });
    } catch { /* don't break chat flow */ }
    const escaped = text.startsWith('/') ? '\u200B' + text : text;
    return origSend(sessionId, escaped);
  };

  if (options.onTierChange) tierManager.onTierChange(options.onTierChange);

  const customEndpoints = config.endpoints || [];

  const server = createServer((req, res) => {
    handleRequest(req, res, { tierManager, router, chatMiddleware, agentServer, config, options, customEndpoints });
  });

  const wss = new WebSocketServer({ noServer: true });
  const chatWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else if (pathname === '/api/ws') {
      chatWss.handleUpgrade(req, socket, head, (ws) => chatWss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  chatWss.on('connection', (ws) => {
    agentServer.transport.handleWsConnection(ws, () => {}, (clientId, envelope) => {
      if (envelope.type === 'chat:send') {
        const sessionId = envelope.sessionId || envelope.payload?.sessionId;
        const text = envelope.payload?.text;
        if (sessionId && text) agentServer.sessions.sendMessage(sessionId, text).catch(err => console.error('[agora] sendMessage error:', err.message));
      }
      if (envelope.type === 'chat:stop') {
        const sessionId = envelope.sessionId || envelope.payload?.sessionId;
        if (sessionId) agentServer.sessions.stopSession(sessionId).catch(() => {});
      }
    });
  });

  agentServer.transport.startHeartbeat();

  wss.on('connection', (ws) => {
    const clientId = generateClientId();
    let clientType = null;
    let handshakeComplete = false;
    const handshakeTimeout = setTimeout(() => { if (!handshakeComplete) ws.close(4001, 'Handshake timeout'); }, 10000);

    ws.on('message', (rawData) => {
      const data = rawData.toString();
      if (!handshakeComplete) {
        const { valid, envelope } = parseEnvelope(data);
        if (!valid || envelope.type !== MSG_SYS_CONNECT) { ws.close(4002, 'First message must be sys:connect'); clearTimeout(handshakeTimeout); return; }
        const validation = validateHandshake(envelope.payload);
        if (!validation.valid) { ws.close(4003, validation.error); clearTimeout(handshakeTimeout); return; }
        clientType = envelope.payload.clientType;
        handshakeComplete = true;
        clearTimeout(handshakeTimeout);
        tierManager.addWsClient(clientId, ws, clientType);
        ws.send(serializeEnvelope(MSG_SYS_CONNECT, { clientId, serverVersion: PROTOCOL_VERSION, tier: tierManager.getTier() }, 'bridge'));
        return;
      }

      const { valid: msgValid, envelope: msgEnv } = parseEnvelope(data);
      if (msgValid && msgEnv.type === 'chat:send') {
        const sid = msgEnv.sessionId || msgEnv.payload?.sessionId;
        const text = msgEnv.payload?.text;
        if (sid && text) agentServer.sessions.sendMessage(sid, text).catch(() => {});
        return;
      }
      if (msgValid && msgEnv.type === 'chat:stop') {
        const sid = msgEnv.sessionId || msgEnv.payload?.sessionId;
        if (sid) agentServer.sessions.stopSession(sid).catch(() => {});
        return;
      }

      const result = router.handleWsMessage(data, clientId);
      if (!result.handled && result.error) ws.send(JSON.stringify({ error: result.error }));
    });

    ws.on('close', () => { clearTimeout(handshakeTimeout); if (clientType) tierManager.removeWsClient(clientId); });
    ws.on('error', () => { clearTimeout(handshakeTimeout); if (clientType) tierManager.removeWsClient(clientId); });
  });

  tierManager.startHeartbeat();

  server.listen(port, () => {
    const name = config.name || 'Agora Agent';
    console.log(`\n  ${name} running on http://localhost:${port}\n`);
    if (options.onReady) options.onReady({ port, tierManager, router });
  });

  const close = () => {
    mcpCleanup();
    agentServer.close().catch(() => {});
    router.cancelWaiters();
    tierManager.stopHeartbeat();
    wss.close();
    server.close();
  };

  return { server, wss, tierManager, router, agentServer, close };
}

function buildSystemPrompt(config) {
  const parts = [];
  if (config.agent?.systemPrompt) parts.push(config.agent.systemPrompt);

  parts.push('');
  parts.push('VISUAL CANVAS COMMANDS (appear in the visual panel):');
  parts.push('- Diagrams: use ```mermaid fenced blocks — auto-routed to the visual panel with zoom/pan controls.');
  parts.push('  Or explicit: <!-- canvas:diagram: {"format":"mermaid","content":"graph TD\\n  A-->B"} -->');
  parts.push('- Rich HTML: <!-- canvas:html: {"html":"<div>...</div>"} -->');
  parts.push('- Web embeds: <!-- canvas:web-embed: {"url":"https://example.com","title":"Docs"} -->');
  parts.push('- Celebrations: <!-- canvas:celebrate: {"type":"xp","xpAwarded":20} -->');
  parts.push('- Dashboard: <!-- canvas:dashboard: {"progress":{"completed":5,"total":10}} -->');
  parts.push('- Code playground: <!-- canvas:code: {"language":"js","code":"...","tests":[...]} -->');
  parts.push('');
  parts.push('INLINE CHAT COMPONENTS (render inside chat bubbles):');
  parts.push('- Buttons: <!-- buttons: {"id":"x","type":"single","prompt":"Pick:","options":[{"label":"A","value":"a"}]} -->');
  parts.push('  Types: "single", "multi", "rating".');
  parts.push('- Lists: <!-- list: {"id":"x","style":"cards","items":[{"title":"T","description":"D"}]} -->');
  parts.push('- Progress: <!-- progress: {"id":"x","current":3,"total":7,"style":"bar"} -->');
  parts.push('- Cards: <!-- card: {"id":"x","type":"tip","title":"T","content":"text"} -->');
  parts.push('- Code: <!-- code: {"id":"x","language":"js","code":"const x = 1;"} -->');
  parts.push('- Steps: <!-- steps: {"id":"x","steps":[{"label":"Step 1","status":"done"}]} -->');
  parts.push('');
  parts.push('SUGGESTIONS:');
  parts.push('- Suggestion chips: <!-- suggestions: [{"label":"Option","text":"message to send"}] -->');
  parts.push('');
  parts.push('MEDIA AUTO-ROUTING:');
  parts.push('- YouTube, Vimeo, image, and video URLs in your text are auto-detected and routed to the visual panel.');
  parts.push('');
  parts.push('AUTO-ENHANCEMENT:');
  parts.push('- Blockquote tips (> **Pro Tip:** ...) and warnings (> **Warning:** ...) auto-convert to rich cards.');
  parts.push('- Bold-title lists auto-convert to styled list components.');
  parts.push('- These only trigger when no explicit smart components are present in the message.');

  return parts.join('\n');
}

/**
 * Write a minimal CLAUDE.md to the project cwd if one doesn't exist.
 * The SDK reads this file automatically via settingSources: ['user', 'project'].
 */
export function ensureClaudeMd(config) {
  const claudePath = join(process.cwd(), 'CLAUDE.md');
  if (existsSync(claudePath)) return false;

  const name = config.name || 'Agora Agent';
  const content = `# ${name}

You are the AI agent powering **${name}**. This file is automatically loaded by the Claude Code SDK.

## Visual Capabilities

You have a rich visual canvas alongside the chat panel. For the full API reference, read the **agora-canvas** skill:

\`\`\`
Read skills/agora-canvas/SKILL.md
\`\`\`

### Quick Reference

- Mermaid diagrams: use \\\`\\\`\\\`mermaid fenced blocks (auto-routed to visual panel)
- Rich HTML / images / videos: \`<!-- canvas:html: {...} -->\`
- Web embeds: \`<!-- canvas:web-embed: {...} -->\`
- Celebrations: \`<!-- canvas:celebrate: {...} -->\`
- Buttons: \`<!-- buttons: {...} -->\` (single/multi/rating)
- Lists / Cards / Progress / Steps: \`<!-- list/card/progress/steps: {...} -->\`
- Suggestion chips: \`<!-- suggestions: [...] -->\` (always last)
- Media URLs (YouTube, Vimeo, images, videos) are auto-detected
- Blockquote tips and warnings auto-convert to rich cards
`;

  try {
    writeFileSync(claudePath, content);
    console.log('  Generated CLAUDE.md for agent context');
    return true;
  } catch {
    return false;
  }
}

function buildCanvasConfig(config) {
  const canvas = config.canvas || {};
  return {
    name: config.name || 'Agora Agent',
    theme: canvas.theme || 'dark',
    accent: canvas.accent || '#58a6ff',
    branding: canvas.branding || { title: config.name || 'Agora' },
    welcome: canvas.welcome || null,
    components: (canvas.components || []).map(c => ({
      type: c.type,
      url: c.url || null,
      label: c.label || c.type,
    })),
  };
}

function handleRequest(req, res, ctx) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/chat') || pathname === '/api/sse' || pathname === '/api/health') {
    try { ctx.chatMiddleware(req, res); } catch (err) {
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Internal server error' })); }
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/sse') { handleSse(req, res, ctx.tierManager); return; }
  if (req.method === 'POST' && pathname === '/api/event') { handleApiEvent(req, res, ctx.router); return; }
  if (req.method === 'GET' && pathname === '/api/tier') { sendJson(res, 200, ctx.tierManager.getTierInfo()); return; }
  if (req.method === 'GET' && pathname === '/api/events') { sendJson(res, 200, { events: ctx.router.pollEvents() }); return; }

  if (req.method === 'GET' && pathname === '/api/events/wait') {
    const timeout = Math.min(parseInt(url.searchParams.get('timeout') || '30000'), MAX_LONG_POLL_TIMEOUT_MS);
    ctx.router.pollEventsAsync(timeout).then(events => sendJson(res, 200, { events }));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/canvas') { handleApiCanvas(req, res, ctx.router, url); return; }

  // Session management
  if (req.method === 'GET' && pathname === '/api/sessions') { sendJson(res, 200, { sessions: listStoredSessions() }); return; }
  const sessionMatch = pathname.match(/^\/api\/sessions\/([a-f0-9-]+)$/);
  if (sessionMatch) {
    const sid = sessionMatch[1];
    if (req.method === 'GET') { sendJson(res, 200, getStoredSession(sid) || { error: 'Not found' }); return; }
    if (req.method === 'PUT') { readBody(req, (err, body) => { if (err) { sendJson(res, 400, { error: 'Bad request' }); return; } const updated = updateStoredMeta(sid, body); sendJson(res, updated ? 200 : 404, updated || { error: 'Not found' }); }); return; }
    if (req.method === 'DELETE') { const ok = deleteStoredSession(sid); try { ctx.agentServer.sessions.closeSession(sid).catch(() => {}); } catch {} sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Not found' }); return; }
  }
  if (req.method === 'DELETE' && pathname === '/api/sessions') { const count = purgeStoredSessions(); ctx.agentServer.sessions.closeAll().catch(() => {}); sendJson(res, 200, { ok: true, deleted: count }); return; }

  // Config endpoint for canvas SPA
  if (req.method === 'GET' && pathname === '/api/config') {
    const canvasConfig = buildCanvasConfig(ctx.config);
    sendJson(res, 200, canvasConfig);
    return;
  }

  // Custom endpoints from config
  const endpointCtx = {
    tierManager: ctx.tierManager,
    router: ctx.router,
    sendJson: (status, data) => sendJson(res, status, data),
    readBody: (cb) => readBody(req, cb),
    config: ctx.config,
  };
  for (const ep of ctx.customEndpoints) {
    if (req.method === (ep.method || 'GET').toUpperCase() && pathname === ep.path) {
      ep.handler(req, res, endpointCtx);
      return;
    }
  }

  // Health check
  if (req.method === 'GET' && pathname === '/health') {
    const mcpNames = ctx.config.agent?.mcpServers ? Object.keys(ctx.config.agent.mcpServers) : [];
    sendJson(res, 200, { status: 'ok', name: ctx.config.name || 'Agora Agent', tier: ctx.tierManager.getTierInfo(), uptime: process.uptime(), mcpServers: mcpNames });
    return;
  }

  // Static files
  if (req.method === 'GET') {
    const canvasDist = ctx.options.canvasDist;
    if (canvasDist && serveStatic(res, pathname, canvasDist)) return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

function handleSse(req, res, tierManager) {
  const clientId = generateClientId();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
  const connectMsg = JSON.stringify(createEnvelope(MSG_SYS_CONNECT, { clientId, serverVersion: PROTOCOL_VERSION, tier: tierManager.getTier() }, 'bridge'));
  res.write(`data: ${connectMsg}\n\n`);
  tierManager.addSseClient(clientId, res, 'canvas');
  req.on('close', () => tierManager.removeSseClient(clientId));
  req.on('error', () => tierManager.removeSseClient(clientId));
}

function handleApiEvent(req, res, router) {
  readBody(req, (err, body) => {
    if (err) { sendJson(res, 400, { error: 'Invalid request body' }); return; }
    const result = router.handleRestEvent(body);
    sendJson(res, result.ok ? 200 : 400, result.ok ? { ok: true } : { error: result.error });
  });
}

function handleApiCanvas(req, res, router, url) {
  readBody(req, (err, body) => {
    if (err) { sendJson(res, 400, { error: 'Invalid request body' }); return; }
    const { valid, envelope, error } = parseEnvelope(body);
    if (!valid) { sendJson(res, 400, { error }); return; }

    router.routeVisualCommand(envelope);

    if (envelope.await) {
      const timeout = Math.min((envelope.await.timeout || 30) * 1000, MAX_LONG_POLL_TIMEOUT_MS);
      router.pollEventsAsync(timeout).then(events => {
        const match = events.find(e => e.type === envelope.await.event);
        sendJson(res, 200, { ok: true, event: match || null, events });
      });
    } else {
      sendJson(res, 200, { ok: true });
    }
  });
}

function serveStatic(res, pathname, distDir) {
  if (!distDir || !existsSync(distDir)) return false;
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (filePath.includes('..')) return false;
  const fullPath = join(distDir, filePath);
  if (!existsSync(fullPath)) {
    const indexPath = join(distDir, 'index.html');
    if (existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      createReadStream(indexPath).pipe(res);
      return true;
    }
    return false;
  }
  const ext = extname(fullPath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  createReadStream(fullPath).pipe(res);
  return true;
}

function readBody(req, cb) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString())); }
    catch (e) { cb(e); }
  });
  req.on('error', cb);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
