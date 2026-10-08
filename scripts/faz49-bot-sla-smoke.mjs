#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMessagingThread, appendMessagingMessage } from '../server/messaging/store.mjs';
import { getMessagingBotHub } from '../server/messaging/botConfig.mjs';
import { getMessagingSlaMetrics } from '../server/messaging/sla.mjs';
import { getPostaAiRuntimeConfig } from '../server/messaging/aiConfig.mjs';
const dir = await mkdtemp(join(tmpdir(), 'ek-bot-'));
try {
  const ai = getPostaAiRuntimeConfig();
  if (!ai.model) throw new Error('ai config model');

  const hub = await getMessagingBotHub(dir, 'main');
  if (!hub.bot?.enabled) throw new Error('bot should be enabled by default');

  const created = await createMessagingThread(dir, 'main', {
    customerId: 'c1',
    customerName: 'Test',
    initialMessage: 'kargo ne zaman gelir',
    initialDirection: 'customer',
  });
  if (!created.ok || !created.thread) throw new Error('thread create');
  const threadId = created.thread.id;

  const msgs = await appendMessagingMessage(dir, 'main', threadId, {
    bodyText: 'operatör lütfen',
    direction: 'customer',
  });
  if (!msgs.ok || !msgs.thread?.botHandoff) throw new Error('handoff flag');

  const staff = await appendMessagingMessage(dir, 'main', threadId, {
    bodyText: 'Merhaba, size yardımcı oluyorum.',
    direction: 'staff',
    messageKind: 'human',
  });
  if (!staff.ok || !staff.thread?.firstStaffResponseAt) throw new Error('first staff response SLA');

  const sla = await getMessagingSlaMetrics(dir, 'main', { days: 7 });
  if (!sla.ok || (sla.firstResponse?.samples ?? 0) < 1) throw new Error('sla samples');

  console.log('OK    bot FAQ/handoff + SLA first response + ai config');
  console.log('\nFaz 49 bot/SLA smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
