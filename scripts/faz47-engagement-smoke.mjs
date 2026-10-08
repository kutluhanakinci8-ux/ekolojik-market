#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPostaEngagementCsv,
  getPostaEngagementSummary,
  recordEngagementBounce,
} from '../server/postaEngagement.mjs';
import { appendCustomerTrackingNotice, DEFAULT_CUSTOMER_TRACKING_NOTICE } from '../server/postaCustomerEmailCompliance.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-eng-'));
try {
  await recordEngagementBounce(dir, {
    outboxId: 'o1',
    to: 'a@t.com',
    subject: 's',
    error: 'e',
    tenantId: 'shop-a',
  });
  await recordEngagementBounce(dir, {
    outboxId: 'o2',
    to: 'b@t.com',
    subject: 's2',
    error: 'e2',
    tenantId: 'shop-b',
  });
  const a = await getPostaEngagementSummary(dir, { days: 7, tenantId: 'shop-a' });
  const b = await getPostaEngagementSummary(dir, { days: 7, tenantId: 'shop-b' });
  if (a.counts?.bounces !== 1 || b.counts?.bounces !== 1) {
    throw new Error('tenant bounce filter');
  }
  const csv = await buildPostaEngagementCsv(dir, { type: 'bounces', days: 7, tenantId: 'shop-a' });
  if (!csv.csv.includes('shop-a') || csv.csv.includes('shop-b')) {
    throw new Error('bounce csv tenant filter');
  }
  const notice = await appendCustomerTrackingNotice(dir, 'main', { text: 'Merhaba', html: '<p>Hi</p>' });
  if (!notice.text.includes('Merhaba')) throw new Error('notice append');
  if (!DEFAULT_CUSTOMER_TRACKING_NOTICE.includes('KVKK')) throw new Error('default notice');
  console.log('OK    tenant engagement filter + KVKK notice helper');
  console.log('\nFaz 47 engagement smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
