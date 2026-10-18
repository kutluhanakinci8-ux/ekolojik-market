#!/usr/bin/env node
/**
 * Greenleaf yerel servis — dist + server.mjs, veri ./data
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMarketPosEnv } from '../server/loadEnv.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
loadMarketPosEnv(ROOT);

const dataDir = process.env.MARKET_POS_DATA_DIR?.trim()
  || join(ROOT, 'data');
const port = process.env.PORT?.trim() || '5190';
const host = process.env.HOST?.trim() || '127.0.0.1';

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('dist/ yok. Önce: npm run build');
  process.exit(1);
}

const env = {
  ...process.env,
  MARKET_POS_DATA_DIR: dataDir,
  PORT: port,
  HOST: host,
  GREENLEAF_DESKTOP: process.env.GREENLEAF_DESKTOP || '1',
  EKOLOJIK_PUBLIC_ORIGIN: process.env.EKOLOJIK_PUBLIC_ORIGIN || `http://${host}:${port}`,
};

console.log('Greenleaf POS');
console.log(`  URL   : http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/app`);
console.log(`  Veri  : ${dataDir}`);

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
