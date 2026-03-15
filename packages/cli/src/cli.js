#!/usr/bin/env node

/**
 * Agora Agent CLI
 *
 * Commands:
 *   agora-agent init <name>  — Scaffold a new agent project
 *   agora-agent dev          — Start dev server (bridge + canvas)
 *   agora-agent build        — Build canvas for production
 */

import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'init':
      await handleInit(args[1]);
      break;
    case 'dev':
      await handleDev();
      break;
    case 'build':
      console.log('Build command coming soon — use Vite directly for now.');
      break;
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
  Agora Agent UI — Framework for smart chat web apps

  Usage:
    agora-agent init <name>   Scaffold a new agent project
    agora-agent dev           Start development server
    agora-agent build         Build canvas for production
    agora-agent --help        Show this help
  `);
}

async function handleInit(name) {
  if (!name) {
    console.error('Usage: agora-agent init <project-name>');
    process.exit(1);
  }

  const targetDir = resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  const templateDir = join(__dirname, '..', 'templates', 'starter');

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, 'skills', 'hello'), { recursive: true });
  mkdirSync(join(targetDir, 'skills', 'agora-canvas'), { recursive: true });

  writeFileSync(join(targetDir, 'agora.config.js'), `export default {
  name: '${name}',
  port: 3456,

  agent: {
    systemPrompt: [
      'You are a helpful AI assistant.',
      'You have rich visual capabilities — read the agora-canvas skill for the full API.',
      'Use mermaid diagrams to explain concepts visually.',
      'Use inline cards for tips and warnings, progress bars for tracking, and suggestion chips to guide the conversation.',
      'Use canvas:html for images and videos, canvas:web-embed for external sites.',
    ].join('\\n'),
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: 'bypassPermissions',
    // mcpServers: {
    //   'my-server': {
    //     command: 'npx',
    //     args: ['-y', '@modelcontextprotocol/server-example'],
    //     env: {},
    //   },
    // },
  },

  plugins: [
    { type: 'local', path: './skills' }
  ],

  canvas: {
    theme: 'dark',
    accent: '#58a6ff',
    branding: { title: '${name}' },
    welcome: {
      title: 'Welcome!',
      subtitle: 'How can I help you today?',
      suggestions: [
        { label: 'Get started', text: 'Help me get started' },
        { label: 'What can you do?', text: 'What are your capabilities?' },
      ],
    },
  },
};
`);

  writeFileSync(join(targetDir, 'skills', 'hello', 'SKILL.md'), `# Hello Skill

When the user says hello or asks for a greeting, respond warmly and offer to help.

## Procedure

1. Greet the user by name if known, otherwise warmly
2. Briefly explain what you can help with using an info card:

\\\`\\\`\\\`
<!-- card: {"id":"welcome","type":"tip","title":"Getting Started","content":"I can help you with diagrams, code review, planning, and more. Just ask!"} -->
\\\`\\\`\\\`

3. Show a quick architecture overview with a diagram:

\\\`\\\`\\\`mermaid
graph LR
  User[You] -->|ask| Agent[AI Agent]
  Agent -->|diagrams| Canvas[Visual Panel]
  Agent -->|text| Chat[Chat Panel]
\\\`\\\`\\\`

4. Offer suggestion chips for common tasks:

\\\`\\\`\\\`
<!-- suggestions: [{"label":"Show me a diagram","text":"Draw a diagram of a web app architecture"},{"label":"Help me code","text":"Help me write some code"},{"label":"Review code","text":"Review my code for issues"}] -->
\\\`\\\`\\\`
`);

  // Copy the framework canvas API skill
  const canvasSkillSrc = join(__dirname, '..', '..', '..', 'skills', 'agora-canvas', 'SKILL.md');
  const canvasSkillDst = join(targetDir, 'skills', 'agora-canvas', 'SKILL.md');
  if (existsSync(canvasSkillSrc)) {
    writeFileSync(canvasSkillDst, readFileSync(canvasSkillSrc, 'utf-8'));
  } else {
    writeFileSync(canvasSkillDst, '# Agora Canvas API\\n\\nSee https://github.com/shayke-cohen/agora-agent-ui for the full canvas API reference.\\n');
  }

  writeFileSync(join(targetDir, 'CLAUDE.md'), `# ${name}

You are the AI agent powering **${name}**. This file is automatically loaded by the Claude Code SDK at startup.

## Visual Capabilities

You have a rich visual canvas alongside the chat panel. Use it to show diagrams, images, videos, dashboards, and interactive components.

For the full API reference — all canvas commands, inline components, interactive patterns, and ordering rules — read the **agora-canvas** skill:

\`\`\`
Read skills/agora-canvas/SKILL.md
\`\`\`

### Quick Reference

| Command | Where | How |
|---|---|---|
| Mermaid diagrams | Visual panel | \\\`\\\`\\\`mermaid fenced blocks (auto-routed) |
| Rich HTML / images / videos | Visual panel | \`<!-- canvas:html: {...} -->\` |
| Web embeds | Visual panel | \`<!-- canvas:web-embed: {...} -->\` |
| Celebrations | Visual panel | \`<!-- canvas:celebrate: {...} -->\` |
| Buttons (single/multi/rating) | Chat bubble | \`<!-- buttons: {...} -->\` |
| Lists / Cards / Progress / Steps | Chat bubble | \`<!-- list/card/progress/steps: {...} -->\` |
| Suggestion chips | Bottom of chat | \`<!-- suggestions: [...] -->\` |

### Conventions

- Use HTML comment syntax for all structured components
- Canvas commands are stripped from displayed text — the user only sees the rendered component
- Place suggestion chips last in every response
- Media URLs (YouTube, Vimeo, images, videos) are auto-detected and routed to the visual panel
- Blockquote tips (\`> **Pro Tip:** ...\`) and warnings auto-convert to rich cards
- Use \`curl POST /api/canvas\` with \`await\` for interactive commands that need a user response
`);

  writeFileSync(join(targetDir, 'package.json'), JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'agora-agent dev',
    },
    dependencies: {
      'agora-agent': '^0.1.0',
    },
  }, null, 2));

  console.log(`
  Created ${name}/ with:
    agora.config.js           — Agent configuration
    CLAUDE.md                 — Agent context (auto-loaded by SDK)
    skills/hello/             — Example skill
    skills/agora-canvas/      — Canvas API reference skill
    package.json              — Project dependencies

  Next steps:
    cd ${name}
    npm install
    npx agora-agent dev
  `);
}

async function handleDev() {
  const configPath = resolve(process.cwd(), 'agora.config.js');

  const { loadConfig, startServer } = await import('@agora-agent/server');

  const config = await loadConfig(configPath);

  await startServer(config, {
    onReady: ({ port }) => {
      console.log(`  Open http://localhost:${port} in your browser.\n`);
    },
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
