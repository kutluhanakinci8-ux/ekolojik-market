#!/usr/bin/env node
/**
 * Faz 45 — JMAP lite read-only köprü smoke (yerel modül + isteğe bağlı HTTP).
 * node scripts/jmap-lite-smoke.mjs
 * EKOLOJIK_VERIFY_BASE_URL=http://127.0.0.1:5180 node scripts/jmap-lite-smoke.mjs
 */
import {
  getPostaJmapLiteSession,
  listPostaJmapLiteMailboxes,
  queryPostaJmapLiteMailbox,
} from '../server/postaJmapLite.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = process.env.EKOLOJIK_VERIFY_BASE_URL?.trim();

function pass(msg) {
  console.log(`OK    ${msg}`);
}

async function localSmoke() {
  const session = getPostaJmapLiteSession();
  if (!session.ok || !session.capabilities?.['ekolojik:posta:lite']) {
    throw new Error('session');
  }
  pass('session capabilities v2');

  const mailboxes = listPostaJmapLiteMailboxes();
  if (!mailboxes.ok || !mailboxes.mailboxes?.some((m) => m.id === 'gonderilen')) {
    throw new Error('mailbox/query');
  }
  pass(`Mailbox/query (${mailboxes.mailboxes.length} klasör)`);

  const dataDir = await mkdtemp(join(tmpdir(), 'ek-jmap-'));
  try {
    const q = await queryPostaJmapLiteMailbox(dataDir, 'main', { folder: 'gelen', limit: 5 });
    if (!q.ok || q.method !== 'Email/query') throw new Error('Email/query');
    pass('Email/query (boş dataDir)');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function httpSmoke() {
  if (!base) return;
  const paths = [
    '/api/posta/jmap-lite/session',
    '/api/posta/jmap-lite/Mailbox/query',
    '/api/posta/jmap-lite/Email/query?folder=gelen&limit=2',
  ];
  for (const path of paths) {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`);
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(`${path} HTTP ${res.status}`);
    pass(`HTTP ${path.split('?')[0]}`);
  }
}

try {
  await localSmoke();
  await httpSmoke();
  console.log('\nJMAP lite smoke: PASS');
} catch (e) {
  console.error('FAIL ', e instanceof Error ? e.message : e);
  process.exit(1);
}
