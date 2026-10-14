#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pickSupportAssignee, isSupportAutoAssignEnabled } from '../server/platformSupportAssign.mjs';
import { maybeSpawnCasesForTenantAlerts, isTenantAlertCaseSpawnEnabled } from '../server/platformSupportTenantAlertCases.mjs';
import { pushZendeskCommentForCaseReply } from '../server/platformSupportZendesk.mjs';
import { ingestInboundChannelMessage } from '../server/messaging/omnichannel.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-support-backlog-'));
process.env.EKOLOJIK_SMS_PROVIDER = 'mock';

try {
  assert(isSupportAutoAssignEnabled(), 'auto assign default on');
  const a1 = await pickSupportAssignee(dir);
  const a2 = await pickSupportAssignee(dir);
  assert(a1 === null || typeof a1 === 'string', 'assignee pick');

  assert(isTenantAlertCaseSpawnEnabled() === false, 'tenant alert default off');
  process.env.EKOLOJIK_SUPPORT_TENANT_ALERT_CASE = '1';
  const spawned = await maybeSpawnCasesForTenantAlerts(dir, [
    {
      tenantId: 'demo',
      businessName: 'Demo',
      alerts: [{ kind: 'low_stock', severity: 'warning', title: 'Stok', message: '3 ürün düşük' }],
    },
  ]);
  assert(spawned.spawned === 1, 'tenant alert case');
  delete process.env.EKOLOJIK_SUPPORT_TENANT_ALERT_CASE;

  const skipped = await pushZendeskCommentForCaseReply(dir, { id: 'x', externalTicketRef: null }, {
    channel: 'email',
    body: 'test',
    operatorUsername: 'qa',
  });
  assert(skipped.skipped === true, 'zendesk skip without ref');

  const smsIn = await ingestInboundChannelMessage(dir, 'main', {
    channel: 'sms',
    externalId: 'sms:905551112233',
    customerId: 'sms-905551112233',
    customerName: 'SMS Test',
    bodyText: 'Merhaba SMS v2',
    authorName: 'SMS Test',
    idempotencyKey: 'sms:smoke:1',
  });
  assert(smsIn.ok && smsIn.thread?.channel === 'sms', 'sms inbound thread');

  console.log('platform-support-backlog-smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
