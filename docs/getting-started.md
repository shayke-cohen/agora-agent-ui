# Getting Started

This guide walks you through creating your first Agora agent app from scratch.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Claude Code CLI** — Required for agent functionality. The framework works without it (chat sends/receives work, but no AI responses).

## 1. Create a Project

```bash
npx agora-agent init my-agent
cd my-agent
```

This creates:
```
my-agent/
  agora.config.js              # Agent configuration
  CLAUDE.md                    # Agent context (auto-loaded by SDK)
  skills/hello/SKILL.md        # Example skill
  skills/agora-canvas/SKILL.md # Canvas API reference skill
  package.json                 # Dependencies
```

The `CLAUDE.md` file is automatically loaded by the Claude Code SDK at startup, giving the agent awareness of its visual capabilities. If you delete it, the server will regenerate a minimal version on next startup.

## 2. Configure Your Agent

Edit `agora.config.js`:

```javascript
export default {
  name: 'My Agent',
  port: 3456,

  agent: {
    systemPrompt: `You are a helpful coding assistant.
When the user asks a question, answer clearly and concisely.
Use mermaid diagrams to explain architecture.
Use suggestion chips to guide the conversation.`,
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
  },

  plugins: [
    { type: 'local', path: './skills' },
  ],

  canvas: {
    theme: 'dark',
    accent: '#58a6ff',
    branding: { title: 'My Agent' },
    welcome: {
      title: 'Hello!',
      subtitle: 'I can help you with coding questions.',
      suggestions: [
        { label: 'Explain React hooks', text: 'Explain React hooks with examples' },
        { label: 'Review my code', text: 'Review the code in my project' },
      ],
    },
  },
};
```

## 3. Add Skills

Skills are Markdown files that give your agent specialized procedures. Create `skills/review/SKILL.md`:

```markdown
# Code Review Skill

When the user asks you to review code, follow this procedure.

## Procedure

1. Read the file the user specified
2. Analyze for bugs, performance, and style issues
3. Present findings using inline cards:

\`\`\`
<!-- card: {"id":"issue-1","type":"error","title":"Bug Found","content":"Description of the issue..."} -->
\`\`\`

4. Offer next steps with suggestions:

\`\`\`
<!-- suggestions: [{"label":"Fix it","text":"Fix the issues you found"},{"label":"Review another","text":"Review another file"}] -->
\`\`\`
```

## 4. Start the Dev Server

```bash
npm install
npx agora-agent dev
```

Open `http://localhost:3456` in your browser. You'll see:
- Your agent name in the header
- Suggestion chips from your config
- A chat input at the bottom
- A green dot indicating WebSocket connection

## 5. Chat With Your Agent

Type a message or click a suggestion chip. The message flows through:

```
Browser → Bridge Server → Claude Code CLI → Agent Response
                                                ↓
Browser ← Bridge Server ← Visual Interceptor ← Response Text
```

The visual interceptor automatically extracts:
- **Mermaid diagrams** → Opens in the visual panel
- **Suggestion chips** → Shown above the chat input
- **Inline cards/buttons/progress** → Rendered in chat bubbles
- **Media URLs** → Displayed in the visual panel

## What's Next

### Add Custom Message Types

If your agent needs specialized visual components:

```javascript
// agora.config.js
messageTypes: {
  'canvas:my-dashboard': { category: 'canvas' },
},

interceptors: [
  {
    pattern: /<!-- dashboard: (\{[\s\S]*?\}) -->/g,
    handler: (match, json) => ({
      type: 'canvas:my-dashboard',
      payload: JSON.parse(json),
    }),
  },
],
```

See [Custom Components](custom-components.md) for building React components for the visual panel.

### Add Custom Endpoints

Expose data APIs alongside your agent:

```javascript
// agora.config.js
endpoints: [
  {
    method: 'GET',
    path: '/api/stats',
    handler: (req, res, ctx) => {
      ctx.sendJson(200, { users: 42 });
    },
  },
],
```

### Explore the Examples

- [ReviewBot](../examples/review-bot/) — Code review with issue cards
- [ProjectPilot](../examples/project-pilot/) — Sprint planning with kanban boards
- [OpsConsole](../examples/ops-console/) — DevOps monitoring dashboards

### Full Configuration Reference

See [configuration.md](configuration.md) for every option.
