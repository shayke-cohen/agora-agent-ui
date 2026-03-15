import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

let capturedConfig = null;

vi.mock('@shaykec/agent-web/server', () => ({
  createAgentServer: (opts) => {
    capturedConfig = opts.config;
    return {
      middleware: () => (req, res) => { res.writeHead(404); res.end(); },
      transport: { handleWsConnection: vi.fn(), startHeartbeat: vi.fn() },
      sessions: {
        sendMessage: vi.fn().mockResolvedValue({}),
        stopSession: vi.fn().mockResolvedValue({}),
        closeSession: vi.fn().mockResolvedValue({}),
        closeAll: vi.fn().mockResolvedValue({}),
      },
      close: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

describe('MCP config passthrough', () => {
  let serverWithMcp;
  let serverWithoutMcp;
  const portWithMcp = 10000 + Math.floor(Math.random() * 50000);
  const portWithoutMcp = portWithMcp + 1;

  afterAll(() => {
    serverWithMcp?.close();
    serverWithoutMcp?.close();
  });

  it('passes mcpServers to createAgentServer when configured', async () => {
    const { startServer } = await import('./server.js');

    const mcpServers = {
      'test-db': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: 'postgres://localhost/test' },
      },
      'remote-mcp': {
        url: 'https://mcp.example.com/sse',
      },
    };

    await new Promise((resolve) => {
      serverWithMcp = startServer(
        {
          name: 'MCP Test',
          port: portWithMcp,
          agent: {
            systemPrompt: 'Test',
            mcpServers,
          },
        },
        { onReady: resolve },
      );
    });

    expect(capturedConfig.mcpServers).toBeDefined();
    expect(capturedConfig.mcpServers).toEqual(mcpServers);
    expect(capturedConfig.mcpServers['test-db'].command).toBe('npx');
    expect(capturedConfig.mcpServers['remote-mcp'].url).toBe('https://mcp.example.com/sse');
  });

  it('omits mcpServers when not configured', async () => {
    capturedConfig = null;
    const { startServer } = await import('./server.js');

    await new Promise((resolve) => {
      serverWithoutMcp = startServer(
        {
          name: 'No MCP Test',
          port: portWithoutMcp,
          agent: { systemPrompt: 'Test' },
        },
        { onReady: resolve },
      );
    });

    expect(capturedConfig.mcpServers).toBeUndefined();
  });

  it('omits mcpServers when empty object', async () => {
    capturedConfig = null;
    const { startServer } = await import('./server.js');
    const portEmpty = portWithoutMcp + 1;
    let srv;

    await new Promise((resolve) => {
      srv = startServer(
        {
          name: 'Empty MCP Test',
          port: portEmpty,
          agent: { systemPrompt: 'Test', mcpServers: {} },
        },
        { onReady: resolve },
      );
    });

    expect(capturedConfig.mcpServers).toBeUndefined();
    srv?.close();
  });
});
