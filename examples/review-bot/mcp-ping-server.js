#!/usr/bin/env node
/**
 * agora-ping — minimal MCP server over stdio.
 * Zero dependencies. Returns AGORA_MCP_VERIFIED_OK on every call.
 */

const SERVER_NAME = 'agora-ping';

function send(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function handleRequest({ id, method, params }) {
  switch (method) {
    case 'initialize':
      return send(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: '1.0.0' },
      });

    case 'notifications/initialized':
      return;

    case 'tools/list':
      return send(id, {
        tools: [{
          name: 'agora_ping',
          description: 'Returns AGORA_MCP_VERIFIED_OK. Call to verify the MCP server is connected.',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Optional echo message' },
            },
          },
        }],
      });

    case 'tools/call': {
      const echo = params?.arguments?.message || 'none';
      const ts = new Date().toISOString();
      process.stderr.write(`[agora-ping] agora_ping called at ${ts} echo=${echo}\n`);
      return send(id, {
        content: [{ type: 'text', text: `AGORA_MCP_VERIFIED_OK | timestamp=${ts} | echo=${echo}` }],
      });
    }

    default:
      if (id !== undefined) {
        const err = JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
        process.stdout.write(`Content-Length: ${Buffer.byteLength(err)}\r\n\r\n${err}`);
      }
  }
}

let buffer = '';
let contentLength = null;

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  while (true) {
    if (contentLength === null) {
      const i = buffer.indexOf('\r\n\r\n');
      if (i === -1) break;
      const m = buffer.slice(0, i).match(/Content-Length:\s*(\d+)/i);
      if (!m) { buffer = buffer.slice(i + 4); continue; }
      contentLength = parseInt(m[1], 10);
      buffer = buffer.slice(i + 4);
    }
    if (buffer.length < contentLength) break;
    const body = buffer.slice(0, contentLength);
    buffer = buffer.slice(contentLength);
    contentLength = null;
    try { handleRequest(JSON.parse(body)); } catch (e) { process.stderr.write(`[agora-ping] error: ${e.message}\n`); }
  }
});

process.stderr.write(`[agora-ping] MCP server started (pid=${process.pid})\n`);
