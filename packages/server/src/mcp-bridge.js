/**
 * MCP Bridge — converts stdio MCP server configs into in-process SDK servers.
 *
 * The Claude Agent SDK's query() ignores stdio mcpServers configs.
 * This bridge spawns each stdio server, discovers its tools via JSON-RPC,
 * and wraps them as in-process SDK servers using createSdkMcpServer().
 *
 * Users write simple configs:
 *   mcpServers: { 'my-server': { command: 'node', args: ['./server.js'] } }
 *
 * Agora transparently converts them to SDK-compatible in-process servers.
 */

import { spawn } from 'child_process';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';

let nextId = 1;

/**
 * Spawn a stdio MCP server, perform handshake, discover tools.
 * Returns { child, tools } where tools is the tools/list result.
 */
function spawnAndDiscover(name, config) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      cwd: config.cwd || process.cwd(),
    });

    let buffer = '';
    let contentLength = null;
    const pending = new Map();
    let resolved = false;

    function sendRequest(method, params = {}) {
      const id = nextId++;
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      child.stdin.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
      });
    }

    function processMessage(body) {
      try {
        const parsed = JSON.parse(body);
        if (parsed.id !== undefined && pending.has(parsed.id)) {
          const { resolve: res, reject: rej } = pending.get(parsed.id);
          pending.delete(parsed.id);
          if (parsed.error) rej(new Error(parsed.error.message));
          else res(parsed.result);
        }
      } catch (e) {
        console.error(`[mcp-bridge:${name}] parse error:`, e.message);
      }
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      while (true) {
        if (contentLength === null) {
          const headerEnd = buffer.indexOf('\r\n\r\n');
          if (headerEnd === -1) break;
          const header = buffer.slice(0, headerEnd);
          const match = header.match(/Content-Length:\s*(\d+)/i);
          if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }
          contentLength = parseInt(match[1], 10);
          buffer = buffer.slice(headerEnd + 4);
        }
        if (buffer.length < contentLength) break;
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        processMessage(body);
      }
    });

    child.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`  [mcp:${name}] ${line}`);
    });

    child.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err); }
    });

    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`MCP server '${name}' exited with code ${code} during discovery`));
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error(`MCP server '${name}' discovery timed out`));
      }
    }, 15000);

    (async () => {
      try {
        await sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'agora-bridge', version: '1.0.0' },
        });

        // Send initialized notification (no response expected)
        const notif = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
        child.stdin.write(`Content-Length: ${Buffer.byteLength(notif)}\r\n\r\n${notif}`);

        const toolsResult = await sendRequest('tools/list', {});
        clearTimeout(timeout);
        resolved = true;
        resolve({ child, tools: toolsResult.tools || [], sendRequest });
      } catch (err) {
        clearTimeout(timeout);
        if (!resolved) { resolved = true; child.kill(); reject(err); }
      }
    })();
  });
}

/**
 * Process all mcpServers from config. For each:
 * - If already an SDK server (type === 'sdk'), pass through unchanged.
 * - If stdio (command + args), spawn, discover tools, wrap as SDK server.
 *
 * @param {Record<string, object>} mcpServers - From agora.config.js
 * @returns {Promise<{ servers: Record<string, object>, cleanup: () => void }>}
 */
export async function bridgeMcpServers(mcpServers) {
  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return { servers: {}, cleanup: () => {} };
  }

  const result = {};
  const children = [];

  for (const [name, config] of Object.entries(mcpServers)) {
    // Already an SDK server — pass through
    if (config.type === 'sdk' || config.instance) {
      result[name] = config;
      continue;
    }

    // Stdio server — spawn and bridge
    if (config.command) {
      try {
        console.log(`  [mcp-bridge] Spawning '${name}' (${config.command} ${(config.args || []).join(' ')})...`);
        const { child, tools, sendRequest } = await spawnAndDiscover(name, config);
        children.push(child);

        const toolDefs = tools.map((t) => ({
          name: t.name,
          description: t.description || `Tool from ${name} MCP server`,
          inputSchema: schemaToZodShape(t.inputSchema),
          handler: async (args) => {
            const callResult = await sendRequest('tools/call', { name: t.name, arguments: args });
            return callResult;
          },
        }));

        const sdkServer = createSdkMcpServer({
          name,
          version: '1.0.0',
          tools: toolDefs,
        });

        result[name] = sdkServer;
        console.log(`  [mcp-bridge] '${name}' ready (${tools.length} tool${tools.length !== 1 ? 's' : ''}: ${tools.map(t => t.name).join(', ')})`);
      } catch (err) {
        console.error(`  [mcp-bridge] Failed to start '${name}': ${err.message}`);
      }
      continue;
    }

    // SSE/HTTP — pass through (SDK may handle these)
    if (config.type === 'sse' || config.type === 'http') {
      result[name] = config;
      continue;
    }

    console.warn(`  [mcp-bridge] Unknown MCP server config for '${name}', passing through`);
    result[name] = config;
  }

  const cleanup = () => {
    for (const child of children) {
      try { child.kill(); } catch {}
    }
  };

  return { servers: result, cleanup };
}

/**
 * Convert a JSON Schema properties object to a minimal zod-compatible shape.
 * The SDK's tool() helper accepts {} for no params, so we only need to
 * handle the case where the MCP server declares properties.
 *
 * Since we're proxying calls, we don't need real validation —
 * we just need the shape for the SDK to advertise the tool correctly.
 */
function schemaToZodShape(inputSchema) {
  // No schema or empty — return empty shape
  if (!inputSchema || !inputSchema.properties || Object.keys(inputSchema.properties).length === 0) {
    return {};
  }

  // For now, return empty shape and let the proxy pass args through.
  // The SDK will still register the tool and the agent can call it.
  return {};
}
