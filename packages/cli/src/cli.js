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
import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
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

  writeFileSync(join(targetDir, 'agora.config.js'), `export default {
  name: '${name}',
  port: 3456,

  agent: {
    systemPrompt: 'You are a helpful AI assistant. Use diagrams to explain concepts visually. Use suggestion chips to guide the conversation.',
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
2. Briefly explain what you can help with
3. Offer suggestion chips for common tasks:

\`\`\`
<!-- suggestions: [{"label":"Show me a diagram","text":"Draw a diagram of a web app architecture"},{"label":"Help me code","text":"Help me write some code"}] -->
\`\`\`
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
    agora.config.js    — Agent configuration
    skills/hello/      — Example skill
    package.json       — Project dependencies

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
