#!/usr/bin/env node
/**
 * Lima kırılma / regresyon — build + birim + isteğe bağlı tenant data
 *   node scripts/lima-pos-break.mjs
 *   node scripts/lima-pos-break.mjs --data-dir ./data
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: REPO, stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → ${code}`))));
  });
}

console.log('==> Lima break: npm run build');
await run('npm', ['run', 'build']);

console.log('\n==> Lima break: unit (pos + receipt)');
await run(process.execPath, [join(REPO, 'scripts/unit/lima-pos.mjs')]);
await run('npx', ['tsx', join(REPO, 'scripts/unit/lima-receipt.ts')]);

const dataDir = arg('data-dir');
if (dataDir) {
  console.log('\n==> Lima break: tenant isolation', dataDir);
  await run(process.execPath, [
    join(REPO, 'scripts/verify-tenant-isolation.mjs'),
    '--data-dir',
    dataDir,
  ]);
}

console.log('\nLima break suite: PASS');
