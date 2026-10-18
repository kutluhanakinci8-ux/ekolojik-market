#!/usr/bin/env node
/**
 * CI: geçici data dir + server.mjs + pre-release-qa
 * Kullanım: node scripts/ci-with-server.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const REPO = join(import.meta.dirname, '..');
const PORT = Number(process.env.EKOLOJIK_CI_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;

const ciDataDir =
  process.env.MARKET_POS_DATA_DIR?.trim()
  || (await mkdtemp(join(tmpdir(), 'ekolojik-ci-data-')));

const env = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  MARKET_POS_DATA_DIR: ciDataDir,
  EKOLOJIK_MESSAGING_BOT: '1',
  EKOLOJIK_PUBLIC_ORIGIN: BASE,
  EKOLOJIK_CONTACT_AUTOREPLY: process.env.EKOLOJIK_CONTACT_AUTOREPLY || '1',
};

const cleanupData = !process.env.MARKET_POS_DATA_DIR?.trim();

if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
  env.PLATFORM_OPERATOR_PASSWORD =
    process.env.PLATFORM_OPERATOR_PASSWORD?.trim() || 'ci-qa-platform-1a04';
  const boot = spawn(
    process.execPath,
    ['scripts/ensure-platform-operator.mjs', '--data-dir', ciDataDir],
    { cwd: REPO, env, stdio: 'inherit' },
  );
  const bootCode = await new Promise((resolve) => boot.on('exit', resolve));
  if (bootCode !== 0) {
    console.error('Platform operator bootstrap failed');
    process.exit(bootCode ?? 1);
  }
}

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
  env: { ...env, EKOLOJIK_QA_BASE_URL: BASE, PLATFORM_OPERATOR_PASSWORD: env.PLATFORM_OPERATOR_PASSWORD },
  stdio: 'inherit',
});

qa.on('exit', async (code) => {
  killServer();
  if (cleanupData) {
    await rm(ciDataDir, { recursive: true, force: true }).catch(() => {});
  }
  process.exit(code ?? 1);
});
