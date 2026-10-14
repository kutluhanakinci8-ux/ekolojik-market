#!/usr/bin/env node
/**
 * Outbox sağlık — failed/pending özet; isteğe bağlı toplu requeue + işleme.
 * Kullanım:
 *   MARKET_POS_DATA_DIR=/var/www/market-pos/data node scripts/ops-outbox-health.mjs
 *   ... --requeue-all --process
 */
import { join } from 'node:path';
import {
  bulkRequeueFailedOutbox,
  getOutboxCounts,
  listFailedOutboxMessages,
  listRecentOutbox,
  processPendingOutbox,
} from '../server/emailOutbox.mjs';

const dataDir = process.env.MARKET_POS_DATA_DIR?.trim()
  ? join(process.env.MARKET_POS_DATA_DIR.trim())
  : join(import.meta.dirname, '..', 'data');

const requeueAll = process.argv.includes('--requeue-all');
const processPending = process.argv.includes('--process');

const counts = await getOutboxCounts(dataDir);
console.log('Outbox sayıları:', counts);

const { pending: pendingRows } = await listRecentOutbox(dataDir, 30);
const pendingOnly = pendingRows.filter((m) => m.status === 'pending' || !m.status);
if (pendingOnly.length) {
  console.log(`\nBekleyen (örnek ${Math.min(pendingOnly.length, 15)}):`);
  for (const row of pendingOnly.slice(0, 15)) {
    console.log(
      `  - ${row.id} tenant=${row.tenantId ?? '—'} to=${row.to} subject=${String(row.subject ?? '').slice(0, 50)}`,
    );
  }
  if (pendingOnly.length > 15) console.log(`  ... +${pendingOnly.length - 15} daha`);
}

const failed = await listFailedOutboxMessages(dataDir, { limit: 50 });
if (!failed.length) {
  console.log('Başarısız kayıt yok.');
} else {
  console.log(`\nBaşarısız (${failed.length}):`);
  for (const row of failed) {
    console.log(
      `  - ${row.id} tenant=${row.tenantId ?? '—'} class=${row.errorClass} to=${row.to} subject=${String(row.subject ?? '').slice(0, 60)}`,
    );
    if (row.lastError) console.log(`      err: ${String(row.lastError).slice(0, 120)}`);
  }
  const destek550 = failed.filter(
    (row) =>
      String(row.to ?? '').includes('destek@') &&
      /550|recipient rejected|unknown in virtual/i.test(String(row.lastError ?? '')),
  );
  if (destek550.length) {
    console.log(
      `\nİpucu: ${destek550.length} kayıt destek@ + 550 — VPS root:\n` +
        '  bash scripts/sunucu-ekolojik-destek-mailbox.sh --apply\n' +
        '  bash scripts/sunucu-ekolojik-support-smtp-recipient-dogrula.sh /var/www/market-pos',
    );
  }
}

if (requeueAll && failed.length) {
  const result = await bulkRequeueFailedOutbox(dataDir, { all: true });
  console.log('\nRequeue:', result);
}

if (processPending) {
  const run = await processPendingOutbox(dataDir, async () => ({ messageId: `ops-health-${Date.now()}` }), {
    limit: 20,
  });
  console.log('\nprocessPendingOutbox:', run);
  console.log('Güncel sayılar:', await getOutboxCounts(dataDir));
}

if (counts.failed > 0 && !requeueAll) {
  process.exitCode = 2;
}
