import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, 'cli.js');

describe('CLI init command', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agora-cli-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('scaffolds a new project with expected files', () => {
    execSync(`node ${cliPath} init my-agent`, { cwd: tempDir, stdio: 'pipe' });
    const projectDir = join(tempDir, 'my-agent');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'agora.config.js'))).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, 'skills', 'hello', 'SKILL.md'))).toBe(true);
  });

  it('generates valid package.json', () => {
    execSync(`node ${cliPath} init test-app`, { cwd: tempDir, stdio: 'pipe' });
    const pkg = JSON.parse(readFileSync(join(tempDir, 'test-app', 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('test-app');
    expect(pkg.type).toBe('module');
    expect(pkg.scripts.dev).toBe('agora-agent dev');
  });

  it('generates config with project name', () => {
    execSync(`node ${cliPath} init cool-bot`, { cwd: tempDir, stdio: 'pipe' });
    const config = readFileSync(join(tempDir, 'cool-bot', 'agora.config.js'), 'utf-8');
    expect(config).toContain("name: 'cool-bot'");
    expect(config).toContain('systemPrompt');
    expect(config).toContain('plugins');
  });

  it('rejects existing directory', () => {
    execSync(`node ${cliPath} init my-agent`, { cwd: tempDir, stdio: 'pipe' });
    try {
      execSync(`node ${cliPath} init my-agent`, { cwd: tempDir, stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).not.toBe(0);
    }
  });
});
