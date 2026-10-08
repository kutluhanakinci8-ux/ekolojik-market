#!/usr/bin/env node
/**
 * CI: geçici data dir + server.mjs + pre-release-qa
 * Kullanım: node scripts/ci-with-server.mjs
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const REPO = join(import.meta.dirname, '..');
const PORT = Number(process.env.EKOLOJIK_CI_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;
const env = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  EKOLOJIK_MESSAGING_BOT: '1',
  EKOLOJIK_PUBLIC_ORIGIN: BASE,
};

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: REPO,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout?.on('data', (d) => { serverLog += d; });
server.stderr?.on('data', (d) => { serverLog += d; });

async function waitHealth(maxMs = 45_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/email/health`);
      if (res.ok) {
        const j = await res.json();
        if (j?.ok) return true;
      }
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  return false;
}

function killServer() {
  if (!server.killed) server.kill('SIGTERM');
}

process.on('exit', killServer);
process.on('SIGINT', () => {
  killServer();
  process.exit(130);
});

const up = await waitHealth();
if (!up) {
  console.error('CI server failed to start:\n', serverLog.slice(-2000));
  killServer();
  process.exit(1);
}

const qa = spawn(process.execPath, ['scripts/pre-release-qa.mjs', BASE], {
  cwd: REPO,
  env: { ...env, EKOLOJIK_QA_BASE_URL: BASE },
  stdio: 'inherit',
});

qa.on('exit', (code) => {
  killServer();
  process.exit(code ?? 1);
});
