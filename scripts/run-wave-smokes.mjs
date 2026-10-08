#!/usr/bin/env node
/** Wave 3 modül smoke testleri (sunucu gerektirmez) */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const SCRIPTS = [
  'scripts/jmap-lite-smoke.mjs',
  'scripts/faz46-caldav-push-smoke.mjs',
  'scripts/faz47-engagement-smoke.mjs',
  'scripts/faz48-omnichannel-smoke.mjs',
  'scripts/faz49-bot-sla-smoke.mjs',
  'scripts/faz50-portal-smoke.mjs',
];

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(REPO, script)], { cwd: REPO, stdio: 'inherit' });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

for (const s of SCRIPTS) {
  console.log(`\n>>> ${s}\n`);
  await run(s);
}
console.log('\nWave smoke suite: PASS');
