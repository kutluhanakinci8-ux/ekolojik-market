#!/usr/bin/env node
/**
 * Zendesk webhook E2E (modül + isteğe bağlı canlı HTTP)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPlatformCase, getPlatformCase } from '../server/platformCaseStore.mjs';
import { processZendeskWebhook } from '../server/platformSupportZendesk.mjs';

const tmp = await mkdtemp(join(tmpdir(), 'zd-e2e-'));
const ticketId = '88001';

try {
  const created = await createPlatformCase(
    tmp,
    {
      kind: 'request',
      channel: 'email',
      subject: 'Zendesk E2E',
      externalTicketRef: { provider: 'zendesk', id: ticketId, url: null },
    },
    'qa',
  );
  if (!created.ok || !created.case) throw new Error('case create failed');

  const webhook = await processZendeskWebhook(tmp, {
    ticket: {
      id: ticketId,
      status: 'solved',
      tags: [`platform_case_${created.case.number}`, 'e2e'],
      comment: { body: 'Webhook test yorumu' },
    },
  });
  if (!webhook.ok || !webhook.matched) {
    throw new Error(`webhook not matched: ${JSON.stringify(webhook)}`);
  }

  const fresh = await getPlatformCase(tmp, created.case.id);
  if (fresh?.status !== 'solved') throw new Error(`expected solved, got ${fresh?.status}`);

  const base = process.env.EKOLOJIK_QA_BASE_URL?.replace(/\/$/, '');
  const secret = process.env.EKOLOJIK_ZENDESK_WEBHOOK_SECRET?.trim();
  if (base && secret) {
    const res = await fetch(`${base}/api/platform/support/zendesk/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zendesk-webhook-secret': secret,
      },
      body: JSON.stringify({
        ticket: { id: '999999', status: 'open', tags: ['platform_case_1'] },
      }),
    });
    if (res.status !== 401 && res.status !== 200) {
      throw new Error(`live webhook HTTP ${res.status}`);
    }
    console.log('OK   live webhook endpoint', res.status);
  }

  console.log('platform-support-zendesk-e2e: PASS');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
