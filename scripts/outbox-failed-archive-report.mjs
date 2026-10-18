#!/usr/bin/env node
/**
 * Arşivlenmiş veya aktif failed outbox — hata sınıfı özeti (RCA).
 * Kullanım: node scripts/outbox-failed-archive-report.mjs /var/www/market-pos/data [limitPerDir]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyOutboxLastError } from '../server/emailOutbox.mjs';

const dataDir = process.argv[2] || '/var/www/market-pos/data';
const cap = Math.min(Number(process.argv[3]) || 500, 2000);
const failedRoot = join(dataDir, 'email-outbox', 'failed');

async function collectJsonPaths(dir, acc, depth = 0) {
  if (depth > 4 || acc.length >= cap) return;
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of names) {
    if (acc.length >= cap) break;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      await collectJsonPaths(p, acc, depth + 1);
    } else if (ent.name.endsWith('.json')) {
      acc.push(p);
    }
  }
}

const paths = [];
await collectJsonPaths(failedRoot, paths);

const breakdown = {};
const sources = {};
const samples = {};

for (const p of paths) {
  let msg;
  try {
    msg = JSON.parse(await readFile(p, 'utf8'));
  } catch {
    continue;
  }
  const cls = classifyOutboxLastError(msg.lastError);
  breakdown[cls] = (breakdown[cls] ?? 0) + 1;
  const src = msg.source ?? '?';
  sources[src] = (sources[src] ?? 0) + 1;
  if (!samples[cls]) samples[cls] = String(msg.lastError ?? '').slice(0, 200);
}

console.log(JSON.stringify({ scanned: paths.length, root: failedRoot, breakdown, sources, samples }, null, 2));
