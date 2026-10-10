#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], { cwd: REPO, stdio: 'inherit' });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

await run(join(REPO, 'scripts/unit/outbox-auth.mjs'));
await run(join(REPO, 'scripts/unit/lima-pos.mjs'));
await run(join(REPO, 'scripts/verify-staging-server-shim.mjs'));

await new Promise((resolve, reject) => {
  const p = spawn('npx', ['tsx', join(REPO, 'scripts/unit/lima-receipt.ts')], {
    cwd: REPO,
    stdio: 'inherit',
    shell: false,
  });
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`lima-receipt exited ${code}`))));
});
