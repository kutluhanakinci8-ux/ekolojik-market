#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPostaEnterpriseCapabilities } from '../server/postaEnterpriseCapabilities.mjs';
import { savePostaDelegates, readPostaDelegates } from '../server/postaDelegation.mjs';
import { scanOutboundDlp, setLegalHold, buildComplianceArchiveExport } from '../server/postaCompliance.mjs';
import {
  upsertPostaMarketingCampaign,
  runPostaMarketingCampaign,
  listPostaMarketingCampaigns,
} from '../server/postaMarketing.mjs';
import { setPostaJmapLiteEmails, getPostaJmapLiteSession } from '../server/postaJmapLite.mjs';
import { getPostaCardDavLitePrincipal } from '../server/postaCardDavLite.mjs';
import { enqueueEkolojikMail } from '../server/emailOutbox.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-posta-enterprise-'));

try {
  const cap = await buildPostaEnterpriseCapabilities(dir, 'main');
  assert(cap.overallPercent === 100, 'overall 100');
  assert(cap.scores.webmailClient === 100, 'webmail score');

  const jmap = getPostaJmapLiteSession();
  assert(jmap.capabilities['ekolojik:posta:lite'].methods.includes('Email/set'), 'Email/set');

  const card = getPostaCardDavLitePrincipal();
  assert(card.version >= 2, 'carddav v2');

  await savePostaDelegates(dir, 'main', {
    delegates: [{ userId: 'demo', role: 'send', displayName: 'Demo' }],
    sendAsAliases: ['destek@ekolojik.market'],
  });
  const del = await readPostaDelegates(dir, 'main');
  assert(del.delegates.length === 1, 'delegates saved');

  const dlpOk = scanOutboundDlp({ subject: 'hello', body: 'no secrets' });
  assert(dlpOk.ok && !dlpOk.blocked, 'dlp pass');

  process.env.EKOLOJIK_POSTA_DLP_BLOCK = '1';
  const dlpBlock = scanOutboundDlp({ subject: 'kart', body: '4111111111111111' });
  assert(dlpBlock.blocked === true, 'dlp block card');
  delete process.env.EKOLOJIK_POSTA_DLP_BLOCK;

  await setLegalHold(dir, 'main', { messageIds: ['msg-1'], hold: true });
  const archive = await buildComplianceArchiveExport(dir, 'main', { limit: 10 });
  assert(archive.ok && archive.eDiscoveryLite, 'archive export');

  const up = await upsertPostaMarketingCampaign(dir, 'main', {
    name: 'Smoke',
    subject: 'Test',
    bodyText: 'Merhaba',
    status: 'draft',
    variantB: { subject: 'B', bodyText: 'B metin' },
  });
  assert(up.ok && up.campaign?.id, 'campaign upsert');
  const listed = await listPostaMarketingCampaigns(dir, 'main');
  assert(listed.campaigns.length >= 1, 'campaign list');

  const run = await runPostaMarketingCampaign(dir, 'main', up.campaign.id, { limit: 5 });
  assert(run.ok, 'campaign run');

  const setEmpty = await setPostaJmapLiteEmails(dir, 'main', []);
  assert(setEmpty.method === 'Email/set', 'jmap set');

  const mail = await enqueueEkolojikMail(dir, {
    to: 'qa@example.com',
    subject: 'dlp smoke',
    text: 'temiz',
    tenantId: 'main',
    idempotencyKey: 'enterprise-smoke-mail',
  });
  assert(mail.ok, 'enqueue mail');

  console.log('posta-enterprise-parity-smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
