# Configuration Reference

Everything in Agora is driven by `agora.config.js` — a single file that defines your agent's behavior, UI, and extensibility.

## Full Schema

```javascript
export default {
  // ─── Identity ──────────────────────────────────────────
  name: 'My Agent',        // Display name (shown in header, health endpoint)
  port: 3456,              // Server port (default: 3456)

  // ─── Agent Behavior ────────────────────────────────────
  agent: {
    systemPrompt: '...',   // System prompt string (or array joined with \n)
    tools: [               // Claude Code tools to enable
      'Bash(*)',           // Shell access
      'Read',              // File reading
      'Write',             // File writing
      'Edit',              // File editing
      'Glob',              // File search by pattern
      'Grep',              // Content search
      'Skill',             // Skill file reading
    ],
    permissionMode: 'bypassPermissions',  // 'default' | 'bypassPermissions'
    mcpServers: {                          // MCP servers available to the agent
      'my-database': {                     // Local MCP server (spawned as child process)
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: 'postgres://localhost/mydb' },
      },
      'remote-api': {                      // Remote MCP server (SSE connection)
        url: 'https://mcp.example.com/sse',
      },
    },
  },

  // ─── Skills / Plugins ──────────────────────────────────
  plugins: [
    { type: 'local', path: './skills' },  // Local skill directory
  ],

  // ─── Custom Message Types ──────────────────────────────
  messageTypes: {
    'canvas:my-widget': { category: 'canvas' },
    'event:my-event':   { category: 'event' },
  },

  // ─── Custom Interceptors ───────────────────────────────
  interceptors: [
    {
      pattern: /<!-- my-widget: (\{[\s\S]*?\}) -->/g,
      handler: (match, captureGroup) => ({
        type: 'canvas:my-widget',
        payload: JSON.parse(captureGroup),
      }),
    },
  ],

  // ─── Custom API Endpoints ──────────────────────────────
  endpoints: [
    {
      method: 'GET',                    // HTTP method
      path: '/api/my-data',            // URL path
      handler: (req, res, ctx) => {    // Handler function
        ctx.sendJson(200, { ok: true });
      },
    },
  ],

  // ─── Canvas UI ─────────────────────────────────────────
  canvas: {
    theme: 'dark',                     // 'dark' (only option currently)
    accent: '#58a6ff',                 // Accent color (hex)
    branding: {
      title: 'My Agent',              // Header title
    },
    welcome: {
      title: 'Welcome!',              // Welcome screen title
      subtitle: 'How can I help?',    // Welcome screen subtitle
      suggestions: [                   // Initial suggestion chips
        { label: 'Get started', text: 'Help me get started' },
        { label: 'Learn more', text: 'What can you do?' },
      ],
    },
  },
};
```

## Sections

### `name`

**Type:** `string`
**Default:** `'Agora Agent'`

The display name for your agent. Shown in:
- The browser tab title
- The header bar
- The `/health` endpoint response
- The `/api/config` response

### `port`

**Type:** `number`
**Default:** `3456`

The port the bridge server listens on. Each demo should use a unique port if running simultaneously.

### `agent`

Configuration for the Claude Code CLI agent.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `systemPrompt` | `string` | `''` | Instructions for the agent. Tip: use an array joined with `\n` for readability. |
| `tools` | `string[]` | `['Bash(*)', 'Read', ...]` | Claude Code tools to enable. |
| `permissionMode` | `string` | `'bypassPermissions'` | Permission mode for tool execution. |
| `mcpServers` | `object` | `{}` | MCP servers the agent can use. See below. |

#### `agent.mcpServers`

**Type:** `Object<string, McpServerConfig>`
**Default:** `{}`

Connect [Model Context Protocol](https://modelcontextprotocol.io/) servers to give the agent access to external tools and data sources. Each key is a server name, and the value describes how to connect.

**Local MCP server** (spawned as a child process):

```javascript
mcpServers: {
  'my-database': {
    command: 'npx',                                      // CLI binary to run
    args: ['-y', '@modelcontextprotocol/server-postgres'], // Arguments
    env: { DATABASE_URL: 'postgres://localhost/mydb' },    // Environment variables (optional)
  },
}
```

**Remote MCP server** (SSE connection):

```javascript
mcpServers: {
  'remote-api': {
    url: 'https://mcp.example.com/sse',  // SSE endpoint URL
  },
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `command` | `string` | For local | CLI binary to spawn |
| `args` | `string[]` | For local | Command-line arguments |
| `env` | `object` | No | Environment variables passed to the process |
| `url` | `string` | For remote | SSE endpoint URL for remote MCP servers |

### `plugins`

**Type:** `Array<{ type: string, path: string }>`
**Default:** `[]`

Skill directories. Currently supports `type: 'local'` which loads Markdown skill files from the specified path relative to the config file.

```javascript
plugins: [
  { type: 'local', path: './skills' },
]
```

Skill files are Markdown documents (`SKILL.md`) in subdirectories:
```
skills/
  review/
    SKILL.md
  planning/
    SKILL.md
```

### `messageTypes`

**Type:** `Object<string, { category: string }>`
**Default:** `{}`

Register custom message types that extend the protocol. Types are strings in the format `category:name`. Categories determine routing behavior.

```javascript
messageTypes: {
  'canvas:dashboard':    { category: 'canvas' },   // Visual panel
  'canvas:status-panel': { category: 'canvas' },
  'event:form-submit':   { category: 'event' },    // User events
}
```

Built-in categories: `canvas`, `event`, `chat`, `session`, `system`.

### `interceptors`

**Type:** `Array<{ pattern: RegExp, handler: Function }>`
**Default:** `[]`

Custom interceptors scan agent text responses for patterns and extract structured messages. They run after the built-in interceptors (Mermaid, suggestions, buttons, inline blocks, media URLs).

```javascript
interceptors: [
  {
    pattern: /<!-- dashboard: (\{[\s\S]*?\}) -->/g,
    handler: (match, captureGroup1) => ({
      type: 'canvas:dashboard',
      payload: JSON.parse(captureGroup1),
    }),
  },
]
```

The `handler` receives the full match and any capture groups. Return an object with `type` and `payload` to emit a structured message, or `null` to skip.

### `endpoints`

**Type:** `Array<{ method: string, path: string, handler: Function }>`
**Default:** `[]`

Custom HTTP endpoints added to the bridge server. Handlers receive the raw Node.js `req`, `res`, and a context object.

```javascript
endpoints: [
  {
    method: 'GET',
    path: '/api/stats',
    handler: (req, res, ctx) => {
      ctx.sendJson(200, { users: 42 });
    },
  },
  {
    method: 'POST',
    path: '/api/webhook',
    handler: (req, res, ctx) => {
      ctx.readBody(req, (err, body) => {
        if (err) return ctx.sendJson(400, { error: 'Bad request' });
        // process body...
        ctx.sendJson(200, { received: true });
      });
    },
  },
]
```

#### Endpoint Context (`ctx`)

| Property | Type | Description |
|----------|------|-------------|
| `ctx.tierManager` | `TierManager` | Client connection manager |
| `ctx.router` | `EventRouter` | Event routing and queuing |
| `ctx.config` | `object` | Full config object |
| `ctx.sendJson(status, data)` | `function` | Send a JSON response |
| `ctx.readBody(req, callback)` | `function` | Parse request body as JSON |

### `canvas`

UI configuration for the React canvas SPA.

#### `canvas.theme`

**Type:** `string`
**Default:** `'dark'`

Currently only `'dark'` is supported. The dark theme uses GitHub-style colors.

#### `canvas.accent`

**Type:** `string` (hex color)
**Default:** `'#58a6ff'`

The accent color used for buttons, links, and highlights. Examples:
- `'#58a6ff'` — Blue (default)
- `'#3fb950'` — Green
- `'#f0883e'` — Orange
- `'#bc8cff'` — Purple
- `'#f85149'` — Red

#### `canvas.branding`

**Type:** `{ title: string }`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | `string` | `'Agora'` | Text shown in the header bar |

#### `canvas.welcome`

**Type:** `{ title: string, subtitle: string, suggestions: Array }`

The welcome screen shown when no messages exist.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Large title text |
| `subtitle` | `string` | Subtitle / description |
| `suggestions` | `Array<{ label, text }>` | Initial suggestion chips |

Each suggestion has:
- `label` — Button text shown to the user
- `text` — Message sent when clicked

## Environment

The config file is a standard ES module. You can use environment variables, dynamic imports, or any Node.js API:

```javascript
export default {
  name: process.env.AGENT_NAME || 'My Agent',
  port: parseInt(process.env.PORT || '3456'),
  agent: {
    systemPrompt: await readFile('./prompt.md', 'utf-8'),
  },
  // ...
};
```
