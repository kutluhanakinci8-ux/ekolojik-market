#!/usr/bin/env node
/**
 * Staging paket uyumluluğu — tek kaynak kök server.mjs (Faz 51.3).
 * Eski kurulumlar release/staging/server.mjs çalıştırabilir; uygulama kökteki server kullanılır.
 */
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootServer = join(__dirname, '..', '..', 'server.mjs');

const child = spawn(process.execPath, [rootServer], {
  cwd: join(__dirname, '..', '..'),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('staging server shim:', err.message);
  process.exit(1);
});
