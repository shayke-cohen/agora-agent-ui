# Agora Agent UI

A framework for building smart chat web apps powered by Claude Code CLI.

Configure a system prompt, drop in skill files, and get a full-featured agent web app with chat, visual side panel, inline controls, and session management — no frontend code required.

## Quick Start

```bash
npx agora-agent init my-agent
cd my-agent
npm install
npx agora-agent dev
# Open http://localhost:3456
```

## How It Works

```
agora.config.js  →  Bridge Server  →  React Canvas
  (your config)     (HTTP/WS/SSE)     (chat + visuals)
```

1. Write an `agora.config.js` with your agent's system prompt, tools, and UI preferences
2. Add skills as Markdown files in a `skills/` directory
3. Run `agora-agent dev` — opens a web app with chat + visual canvas

The framework handles everything else: WebSocket connections, session persistence, message routing, markdown rendering, Mermaid diagrams, inline controls, the visual panel, and agent context via auto-generated `CLAUDE.md`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    agora.config.js                       │
│  name, systemPrompt, tools, plugins, canvas, endpoints  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              @agora-agent/server (Bridge)                │
│  HTTP + WebSocket + SSE hub                             │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ TierManager  │ EventRouter  │ Visual Interceptor   │ │
│  │ (clients)    │ (events)     │ (diagrams, buttons,  │ │
│  │              │              │  suggestions, media)  │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ SessionStore │ Agent Server │ Custom Endpoints     │ │
│  │ (JSON files) │ (Claude SDK) │ (your API routes)    │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              @agora-agent/canvas (React SPA)             │
│  ┌──────────────────────┬───────────────────────────┐   │
│  │    Chat Panel         │    Visual Panel           │   │
│  │  • Messages           │  • Diagram (Mermaid)      │   │
│  │  • Markdown           │  • HtmlContent (iframe)   │   │
│  │  • Inline buttons     │  • WebEmbed (URL)         │   │
│  │  • Inline blocks      │  • Your custom components │   │
│  │  • Suggestion chips   │                           │   │
│  └──────────────────────┴───────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@agora-agent/protocol` | — | Message envelope format, types, tier constants |
| `@agora-agent/server` | — | HTTP + WebSocket + SSE bridge server |
| `@agora-agent/canvas` | — | React SPA (chat shell + composable visual panel) |
| `agora-agent` | — | CLI (`init`, `dev`, `build`) |

## Configuration

Everything is driven by `agora.config.js`:

```javascript
export default {
  name: 'My Agent',
  port: 3456,

  // Agent behavior
  agent: {
    systemPrompt: 'You are a helpful assistant...',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: 'bypassPermissions',
  },

  // Skills (local Markdown files)
  plugins: [
    { type: 'local', path: './skills' },
  ],

  // Custom message types (optional)
  messageTypes: {
    'canvas:my-widget': { category: 'canvas' },
  },

  // Custom interceptors (optional)
  interceptors: [
    {
      pattern: /<!-- my-widget: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:my-widget',
        payload: JSON.parse(json),
      }),
    },
  ],

  // Custom API endpoints (optional)
  endpoints: [
    {
      method: 'GET',
      path: '/api/my-data',
      handler: (req, res, ctx) => {
        ctx.sendJson(200, { hello: 'world' });
      },
    },
  ],

  // Canvas UI
  canvas: {
    theme: 'dark',
    accent: '#58a6ff',
    branding: { title: 'My Agent' },
    welcome: {
      title: 'Welcome!',
      subtitle: 'How can I help?',
      suggestions: [
        { label: 'Get started', text: 'Help me get started' },
      ],
    },
  },
};
```

See [docs/configuration.md](docs/configuration.md) for the full reference.

## Built-in Visual Components

The visual panel ships with three default components:

| Message Type | Component | Description |
|-------------|-----------|-------------|
| `canvas:diagram` | Diagram | Renders Mermaid diagrams (dark theme) |
| `canvas:html` | HtmlContent | Sandboxed iframe for rich HTML |
| `canvas:web-embed` | WebEmbed | Iframe for external URLs |

These are triggered automatically when the agent outputs Mermaid code blocks, HTML content, or URLs. The visual interceptor on the server scans agent responses and routes them as structured messages.

Additional built-in canvas commands:

| Message Type | Trigger | Description |
|-------------|---------|-------------|
| `canvas:celebrate` | `<!-- canvas:celebrate: {...} -->` | Confetti/celebration animations |
| `canvas:dashboard` | `<!-- canvas:dashboard: {...} -->` | Progress dashboards |
| `canvas:code` | `<!-- canvas:code: {...} -->` | Code playground with tests |

Media URLs (YouTube, Vimeo, images, videos) in agent responses are auto-detected and routed to the visual panel.

## Agent Context (`CLAUDE.md`)

The Claude Code SDK reads a `CLAUDE.md` file from the project directory at startup. Agora uses this to give the agent awareness of its visual capabilities.

- **`agora init`** generates a `CLAUDE.md` with the app name, a quick reference table, and a pointer to the `agora-canvas` skill for the full API
- **Server startup** auto-generates a minimal `CLAUDE.md` if one is missing, so existing projects also benefit
- The `agora-canvas` skill (`skills/agora-canvas/SKILL.md`) contains the comprehensive reference for all visual commands, inline components, interactive patterns, and ordering rules

## Custom Components

Register your own React components for custom message types:

```javascript
import { registerComponent } from '@agora-agent/canvas/registry';

function MyWidget({ payload, sendChat, theme }) {
  return (
    <div style={{ padding: 24, color: theme.text }}>
      <h2>{payload.title}</h2>
      <button onClick={() => sendChat('clicked!')}>
        Click me
      </button>
    </div>
  );
}

registerComponent('canvas:my-widget', MyWidget);
```

Custom components receive:
- `payload` — The message payload data
- `sendEvent` — Send a protocol event back to the server
- `sendChat` — Send a chat message as the user
- `theme` — Current theme colors

## Inline Chat Controls

The agent can embed rich controls directly in chat messages using HTML comments:

### Suggestion Chips
```
<!-- suggestions: [{"label":"Option A","text":"I choose A"},{"label":"Option B","text":"I choose B"}] -->
```

### Inline Cards
```
<!-- card: {"id":"tip-1","type":"tip","title":"Pro Tip","content":"Use keyboard shortcuts for faster navigation."} -->
```
Card types: `tip` (blue), `warning` (yellow), `error` (red), `success` (green), `concept` (purple)

### Progress Bars
```
<!-- progress: {"id":"score","label":"Completion","current":7,"total":10} -->
```

### Step Indicators
```
<!-- steps: {"id":"flow","steps":[{"label":"Plan","status":"done"},{"label":"Build","status":"active"},{"label":"Test","status":"pending"}]} -->
```

### Inline Buttons
```
<!-- buttons: {"id":"choice","prompt":"Pick one:","options":[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]} -->
```

## Custom Endpoints

Add API routes that receive full server context:

```javascript
endpoints: [
  {
    method: 'GET',
    path: '/api/stats',
    handler: (req, res, ctx) => {
      // ctx.tierManager — client connection info
      // ctx.router — event routing
      // ctx.config — full config object
      // ctx.sendJson(status, data) — send JSON response
      // ctx.readBody(req, callback) — parse request body
      ctx.sendJson(200, {
        clients: ctx.tierManager.getTierInfo().clients.total,
      });
    },
  },
],
```

## Custom Interceptors

Scan agent responses for patterns and route them as structured messages:

```javascript
interceptors: [
  {
    pattern: /<!-- dashboard: (\{[\s\S]*?\}) -->/g,
    handler: (match, json) => ({
      type: 'canvas:dashboard',
      payload: JSON.parse(json),
    }),
  },
],
```

## Examples

| Demo | Port | Description |
|------|------|-------------|
| [ReviewBot](examples/review-bot/) | 3456 | Code review assistant with issue cards and architecture diagrams |
| [ProjectPilot](examples/project-pilot/) | 3457 | Sprint planning with kanban boards and burndown charts |
| [OpsConsole](examples/ops-console/) | 3458 | DevOps monitoring with service health dashboards |

Each demo shows different Agora features:

- **ReviewBot** — Custom interceptors, review summary component, custom endpoint
- **ProjectPilot** — Kanban/burndown message types, sprint capacity tracking
- **OpsConsole** — Multiple custom endpoints, incident response workflows, status panels

## Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health + tier info |
| `/api/config` | GET | Canvas configuration (theme, branding, welcome) |
| `/api/tier` | GET | Current connection tier |
| `/api/sessions` | GET | List chat sessions |
| `/api/sessions/:id` | GET/PUT/DELETE | Manage a session |
| `/api/event` | POST | Send a protocol event |
| `/api/canvas` | POST | Send a visual command (supports `await`) |
| `/api/events` | GET | Poll queued events |
| `/api/events/wait` | GET | Long-poll for events |
| `/api/chat/start` | POST | Start a new chat session |
| `/api/chat/message` | POST | Send a chat message |
| `/api/chat/sessions` | GET | List sessions (SDK) |
| `/sse` | GET | Server-Sent Events stream |
| `ws://` | — | WebSocket connection |

## Protocol

Messages use a JSON envelope format:

```json
{
  "v": 1,
  "type": "canvas:diagram",
  "payload": { "content": "graph TD; A-->B" },
  "source": "bridge",
  "timestamp": 1710000000000
}
```

Register custom types in `agora.config.js`:

```javascript
messageTypes: {
  'canvas:my-type': { category: 'canvas' },
  'event:my-event': { category: 'event' },
}
```

## Testing

```bash
npm test              # All unit + component + integration tests (169 tests)
npm run test:unit     # Server + protocol unit tests
npm run test:components  # React component tests (JSDOM)
npm run test:integration # Server integration tests
npm run test:e2e      # E2E tests via Argus (21 YAML tests)
```

## Development

```bash
npm install           # Install all workspace deps
npm run dev           # Start bridge + canvas
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Requirements

- Node.js >= 18
- Claude Code CLI (for agent functionality)

## License

MIT
