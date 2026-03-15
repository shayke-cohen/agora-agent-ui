#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const demoName = process.argv[2];
if (!demoName) {
  console.error('Usage: node scripts/run-demo.js <demo-name>');
  console.error('  e.g.: node scripts/run-demo.js review-bot');
  process.exit(1);
}

const configPath = resolve(root, 'examples', demoName, 'agora.config.js');
const canvasDist = resolve(root, 'packages', 'canvas', 'dist');

const { loadConfig, startServer } = await import(resolve(root, 'packages/server/src/server.js'));

const config = await loadConfig(configPath);

startServer(config, {
  canvasDist,
  onReady: ({ port }) => {
    console.log(`  ${config.name || demoName} running on http://localhost:${port}`);
    console.log(`  Open http://localhost:${port} in your browser.\n`);
  },
});
