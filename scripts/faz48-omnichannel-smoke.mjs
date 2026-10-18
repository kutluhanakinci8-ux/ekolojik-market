#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listChannelWebhookIds, handleChannelWebhook } from '../server/integrations/channelWebhook.mjs';
import { getMessagingChannelsHub, saveMessagingChannelsHub } from '../server/messaging/channelConfig.mjs';
import { ingestInboundChannelMessage } from '../server/messaging/omnichannel.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-omni-'));
process.env.EKOLOJIK_WHATSAPP_ACCESS_TOKEN = 'test-token';
process.env.EKOLOJIK_WHATSAPP_PHONE_NUMBER_ID = '123';
process.env.EKOLOJIK_WHATSAPP_VERIFY_TOKEN = 'verify-secret';

try {
  const ids = listChannelWebhookIds();
  if (!ids.includes('whatsapp')) throw new Error('whatsapp adapter missing');

  await saveMessagingChannelsHub(dir, 'main', {
    whatsapp: { enabled: true, verifyToken: 'verify-secret' },
  });

  const verify = await handleChannelWebhook('whatsapp', {
    dataDir: dir,
    tenantId: 'main',
    method: 'GET',
    query: new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-secret',
      'hub.challenge': '999',
    }),
    body: null,
  });
  if (verify.challenge !== '999') throw new Error('verify failed');

  const inbound = await ingestInboundChannelMessage(dir, 'main', {
    channel: 'whatsapp',
    externalId: 'wa:905551112233',
    customerId: 'wa-905551112233',
    customerName: 'Test WA',
    bodyText: 'Merhaba omnichannel',
    authorName: 'Test WA',
    idempotencyKey: 'wa:msg1',
  });
  if (!inbound.ok || inbound.thread?.channel !== 'whatsapp') {
    throw new Error('inbound thread');
  }
  if (inbound.thread.channel !== 'whatsapp') throw new Error('channel field');

  const hub = await getMessagingChannelsHub(dir, 'main');
  if (!hub.whatsapp?.enabled) throw new Error('hub enabled');

  const smsIds = listChannelWebhookIds();
  if (!smsIds.includes('sms')) throw new Error('sms adapter missing');

  const smsIn = await ingestInboundChannelMessage(dir, 'main', {
    channel: 'sms',
    externalId: 'sms:905559998877',
    customerId: 'sms-905559998877',
    customerName: 'SMS',
    bodyText: 'omni sms',
    authorName: 'SMS',
    idempotencyKey: 'sms:f48:1',
  });
  if (!smsIn.ok || smsIn.thread?.channel !== 'sms') throw new Error('sms inbound');

  console.log('OK    webhook registry + WA verify + inbound thread + SMS inbound');
  console.log('\nFaz 48 omnichannel smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
