# Agora Agent UI

A framework for building smart chat web apps powered by Claude Code CLI.

Configure a system prompt, drop in skill files, and get a full-featured agent web app with chat, visual side panel, inline controls, and session management.

## Quick Start

```bash
npx agora-agent init my-agent
cd my-agent
npm install
npx agora-agent dev
```

## How It Works

1. Write an `agora.config.js` with your agent's system prompt, tools, and UI preferences
2. Add skills as Markdown files in a `skills/` directory
3. Run `agora-agent dev` — opens a web app with chat + visual canvas at `http://localhost:3456`

## Architecture

```
@agora-agent/protocol  — Message envelope format, types, tier constants
@agora-agent/server    — HTTP + WebSocket + SSE bridge server
@agora-agent/canvas    — React SPA (chat shell + composable visual panel)
agora-agent            — CLI (init, dev, build)
```

## Configuration

```javascript
// agora.config.js
export default {
  name: 'My Agent',
  port: 3456,

  agent: {
    systemPrompt: 'You are a helpful assistant...',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
  },

  plugins: [{ type: 'local', path: './skills' }],

  canvas: {
    theme: 'dark',
    accent: '#58a6ff',
    welcome: {
      title: 'Welcome!',
      suggestions: [{ label: 'Get started', text: 'Help me get started' }],
    },
  },
};
```

## Examples

- `examples/review-bot/` — Code review agent (config-only, zero custom UI)

## Development

```bash
npm install
npm test          # Run tests
npm run dev       # Start dev server
```

## License

MIT
