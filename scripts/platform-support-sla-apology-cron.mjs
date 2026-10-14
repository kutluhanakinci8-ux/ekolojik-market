#!/usr/bin/env node
/** SLA özür maili — cron (EKOLOJIK_SUPPORT_SLA_AUTO_APOLOGY=1) */
import { join } from 'node:path';
import { buildSlaApologyQueue, sendSlaApologyBatch } from '../server/platformSupportSlaApology.mjs';

const dataDir = process.env.MARKET_POS_DATA_DIR?.trim()
  ? join(process.env.MARKET_POS_DATA_DIR.trim())
  : join(import.meta.dirname, '..', 'data');

if (process.env.EKOLOJIK_SUPPORT_SLA_AUTO_APOLOGY !== '1') {
  console.log('SLA auto apology kapalı (EKOLOJIK_SUPPORT_SLA_AUTO_APOLOGY=1)');
  process.exit(0);
}

const max = Math.min(25, Math.max(1, Number(process.env.EKOLOJIK_SUPPORT_SLA_AUTO_APOLOGY_MAX ?? 5)));
const queue = await buildSlaApologyQueue(dataDir, { limit: max });
if (!queue.count) {
  console.log('Özür kuyruğu boş');
  process.exit(0);
}

const caseIds = queue.items.map((i) => i.id);
const result = await sendSlaApologyBatch(dataDir, { caseIds }, 'sla-cron');
console.log('SLA özür cron:', { queued: queue.count, ...result });
process.exit(result.ok ? 0 : 1);
