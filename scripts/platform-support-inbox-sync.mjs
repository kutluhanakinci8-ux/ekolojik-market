#!/usr/bin/env node
/** destek@ IMAP + outbox köprüsü — cron / manuel senkron */
import { syncPlatformSupportInbox } from '../server/platformSupportInbox.mjs';
import { notifyOpsSupportImapSyncFailure } from '../server/platformSupportOpsNotify.mjs';

const dataDir =
  process.env.MARKET_POS_DATA_DIR?.trim()
  || process.env.MARKET_POS_DATA?.trim()
  || '/var/www/market-pos/data';

const maxMessages = Number(process.env.EKOLOJIK_SUPPORT_IMAP_SYNC_MAX || 50);

const result = await syncPlatformSupportInbox(dataDir, { maxMessages });

if (!result.ok) {
  const err = result.error ?? 'Senkron başarısız';
  console.error(`platform-support-inbox-sync: FAIL — ${err}`);
  await notifyOpsSupportImapSyncFailure(dataDir, { error: err });
  process.exit(1);
}

const summary = result.message ?? `ok scanned=${result.scanned ?? 0} added=${result.added ?? 0}`;
console.log(`platform-support-inbox-sync: ${summary}`);
process.exit(0);
