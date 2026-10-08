#!/usr/bin/env node
/**
 * Yerel birim testleri — outbox idempotency + posta auth + store sanitize (Faz 51)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import {
  idempotencyKeyForTenant,
  enqueueEkolojikMail,
  findOutboxByIdempotency,
} from '../../server/emailOutbox.mjs';
import {
  requiresPostaPosAuth,
  isPostaAuthExempt,
  requiresMessagingPosAuth,
} from '../../server/postaAccessAuth.mjs';
import { sanitizeStoreSnapshotForClient } from '../../server/storeApiSanitize.mjs';

let failed = 0;

function ok(name) {
  console.log(`  ok  ${name}`);
}

function bad(name, err) {
  console.error(`  FAIL ${name}:`, err instanceof Error ? err.message : err);
  failed += 1;
}

function test(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    bad(name, e);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    bad(name, e);
  }
}

// --- outbox ---
test('idempotencyKeyForTenant prefixes tenant', () => {
  assert.equal(idempotencyKeyForTenant('shop-a', 'mail:1'), 'shop-a::mail:1');
  assert.equal(idempotencyKeyForTenant('shop-a', 'shop-a::mail:1'), 'shop-a::mail:1');
});

test('idempotencyKeyForTenant sanitizes unsafe tenant id', () => {
  const key = idempotencyKeyForTenant('a/b', 'x');
  assert.ok(key.startsWith('a_b::'));
});

// --- auth routing ---
test('requiresPostaPosAuth on inbox', () => {
  assert.equal(requiresPostaPosAuth('/api/posta/inbox', 'GET'), true);
});

test('isPostaAuthExempt track open', () => {
  assert.equal(isPostaAuthExempt('/api/posta/track/open/abc', 'GET'), true);
  assert.equal(isPostaAuthExempt('/api/posta/inbox', 'GET'), false);
});

test('requiresMessagingPosAuth', () => {
  assert.equal(requiresMessagingPosAuth('/api/messaging/threads'), true);
  assert.equal(requiresMessagingPosAuth('/api/data'), false);
});

// --- sanitize ---
test('sanitizeStoreSnapshotForClient strips passwordHash', () => {
  const out = sanitizeStoreSnapshotForClient({
    users: [{ id: '1', username: 'u', passwordHash: 'secret', pinHash: 'p' }],
  });
  assert.equal(out.users[0].passwordHash, undefined);
  assert.equal(out.users[0].pinHash, undefined);
  assert.equal(out.users[0].username, 'u');
});

const dir = await mkdtemp(join(tmpdir(), 'ek-unit-outbox-'));
try {
  await testAsync('enqueue idempotency dedupe', async () => {
    const key = `unit:${Date.now()}`;
    const payload = {
      to: 'a@test.com',
      subject: 's',
      text: 'body',
      tenantId: 'main',
      idempotencyKey: key,
    };
    const a = await enqueueEkolojikMail(dir, payload);
    const b = await enqueueEkolojikMail(dir, payload);
    assert.ok(a.ok);
    assert.ok(b.ok);
    const found = await findOutboxByIdempotency(dir, idempotencyKeyForTenant('main', key));
    assert.ok(found);
  });
} finally {
  await rm(dir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\nUnit tests: ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nUnit tests (outbox + auth): PASS');
