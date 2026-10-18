#!/usr/bin/env node
/** Faz 51.3 — release/staging/server.mjs kök server.mjs shim olmalı */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const shim = join(import.meta.dirname, '..', 'release', 'staging', 'server.mjs');
const text = await readFile(shim, 'utf8');
if (!text.includes('server.mjs') || text.includes('createServer(')) {
  console.error('FAIL  staging server is not a shim — use root server.mjs');
  process.exit(1);
}
console.log('OK    release/staging/server.mjs → root shim');
