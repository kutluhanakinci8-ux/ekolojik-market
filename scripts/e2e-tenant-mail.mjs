#!/usr/bin/env node
/**
 * Faz 44 — iki kiracı: ops e-posta izolasyonu, idempotency, adil outbox kuyruğu.
 * Çalıştırma: node scripts/e2e-tenant-mail.mjs
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeTenantStore } from '../server/tenantAuth.mjs';
import { getEffectiveMailPresentation } from '../server/postaSettings.mjs';
import {
  enqueueEkolojikMail,
  findOutboxByIdempotency,
  idempotencyKeyForTenant,
  processPendingOutbox,
} from '../server/emailOutbox.mjs';

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`OK    ${msg}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'ek-tenant-mail-'));
  let exitOk = true;
  try {
    const now = new Date().toISOString();
    for (const [id, ops] of [
      ['shop-alpha', 'ops-alpha@alpha.test'],
      ['shop-beta', 'ops-beta@beta.test'],
    ]) {
      await writeTenantStore(dataDir, id, {
        updatedAt: now,
        settings: {
          postaMail: { opsEmail: ops, fromName: id, updatedAt: now },
        },
      });
    }

    const presA = await getEffectiveMailPresentation(dataDir, 'shop-alpha');
    const presB = await getEffectiveMailPresentation(dataDir, 'shop-beta');
    if (presA.opsEmail !== 'ops-alpha@alpha.test' || presB.opsEmail !== 'ops-beta@beta.test') {
      fail(`ops e-posta izolasyonu: ${presA.opsEmail} / ${presB.opsEmail}`);
      exitOk = false;
    } else {
      pass('tenant ops e-posta override');
    }

    const sharedRawKey = 'contact:ops:shared-id';
    await enqueueEkolojikMail(dataDir, {
      to: 'a@test.com',
      subject: 'A',
      text: 'a',
      source: 'e2e',
      tenantId: 'shop-alpha',
      idempotencyKey: sharedRawKey,
    });
    await enqueueEkolojikMail(dataDir, {
      to: 'b@test.com',
      subject: 'B',
      text: 'b',
      source: 'e2e',
      tenantId: 'shop-beta',
      idempotencyKey: sharedRawKey,
    });
    const keyA = idempotencyKeyForTenant('shop-alpha', sharedRawKey);
    const keyB = idempotencyKeyForTenant('shop-beta', sharedRawKey);
    const hitA = await findOutboxByIdempotency(dataDir, keyA);
    const hitB = await findOutboxByIdempotency(dataDir, keyB);
    if (!hitA || !hitB || hitA.id === hitB.id) {
      fail('idempotency kiracı çapraz çakışma');
      exitOk = false;
    } else {
      pass('idempotency kiracı bazlı');
    }

    for (let i = 0; i < 6; i += 1) {
      await enqueueEkolojikMail(dataDir, {
        to: `heavy-a-${i}@test.com`,
        subject: `A-${i}`,
        text: 'x',
        source: 'e2e-fair',
        tenantId: 'shop-alpha',
        idempotencyKey: `fair:a:${i}`,
      });
    }
    for (let i = 0; i < 2; i += 1) {
      await enqueueEkolojikMail(dataDir, {
        to: `heavy-b-${i}@test.com`,
        subject: `B-${i}`,
        text: 'x',
        source: 'e2e-fair',
        tenantId: 'shop-beta',
        idempotencyKey: `fair:b:${i}`,
      });
    }

    const processedTenants = [];
    const sendFn = async (message) => {
      processedTenants.push(message.tenantId);
      return { messageId: `mock-${message.id}` };
    };
    const run = await processPendingOutbox(dataDir, sendFn, { limit: 4 });
    const unique = new Set(processedTenants);
    if (run.sent < 4 || !unique.has('shop-alpha') || !unique.has('shop-beta')) {
      fail(`adil kuyruk: sent=${run.sent} tenants=${[...unique].join(',')}`);
      exitOk = false;
    } else {
      pass(`adil kuyruk (4 iş, 2 kiracı): ${processedTenants.join(' → ')}`);
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }

  if (exitOk && !process.exitCode) {
    console.log('\nE2E tenant mail: PASS');
  } else {
    process.exitCode = 1;
    console.log('\nE2E tenant mail: FAIL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
