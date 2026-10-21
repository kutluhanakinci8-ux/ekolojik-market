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
await run(join(REPO, 'scripts/unit/store-snapshot-merge-smoke.mjs'));
await run(join(REPO, 'scripts/verify-staging-server-shim.mjs'));
await run(join(REPO, 'scripts/single-version-smoke.mjs'));
await run(join(REPO, 'scripts/platform-support-email-thread-smoke.mjs'));
await run(join(REPO, 'scripts/platform-support-zendesk-smoke.mjs'));
await run(join(REPO, 'scripts/platform-support-zendesk-e2e.mjs'));
await run(join(REPO, 'scripts/crm-sms-smoke.mjs'));
await run(join(REPO, 'scripts/platform-support-backlog-smoke.mjs'));
await run(join(REPO, 'scripts/multi-tenant-data-safety-smoke.mjs'));
await run(join(REPO, 'scripts/posta-enterprise-parity-smoke.mjs'));
