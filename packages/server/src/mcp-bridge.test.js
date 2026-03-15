import { describe, it, expect, vi, afterAll } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock createSdkMcpServer to avoid needing the full SDK in tests
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: ({ name, tools }) => ({
    type: 'sdk',
    name,
    toolCount: tools.length,
    toolNames: tools.map(t => t.name),
    instance: { fake: true },
  }),
}));

const { bridgeMcpServers } = await import('./mcp-bridge.js');

const pingServerPath = resolve(__dirname, '../../../examples/review-bot/mcp-ping-server.js');

describe('MCP Bridge', () => {
  let cleanup;

  afterAll(() => {
    if (cleanup) cleanup();
  });

  it('returns empty for no servers', async () => {
    const result = await bridgeMcpServers({});
    expect(result.servers).toEqual({});
  });

  it('returns empty for null/undefined', async () => {
    const result = await bridgeMcpServers(null);
    expect(result.servers).toEqual({});
  });

  it('passes through SDK servers unchanged', async () => {
    const sdkServer = { type: 'sdk', name: 'test', instance: {} };
    const result = await bridgeMcpServers({ 'test': sdkServer });
    expect(result.servers['test']).toBe(sdkServer);
  });

  it('passes through SSE servers unchanged', async () => {
    const sseServer = { type: 'sse', url: 'https://example.com/sse' };
    const result = await bridgeMcpServers({ 'remote': sseServer });
    expect(result.servers['remote']).toBe(sseServer);
  });

  it('bridges a stdio MCP server into an SDK server', async () => {
    const result = await bridgeMcpServers({
      'agora-ping': {
        command: 'node',
        args: [pingServerPath],
      },
    });
    cleanup = result.cleanup;

    expect(result.servers['agora-ping']).toBeDefined();
    expect(result.servers['agora-ping'].type).toBe('sdk');
    expect(result.servers['agora-ping'].name).toBe('agora-ping');
    expect(result.servers['agora-ping'].toolNames).toContain('agora_ping');
  });

  it('handles failed server gracefully', async () => {
    const result = await bridgeMcpServers({
      'bad-server': {
        command: 'node',
        args: ['-e', 'process.exit(1)'],
      },
    });
    // Should not throw, just skip the failed server
    expect(result.servers['bad-server']).toBeUndefined();
  });
});
