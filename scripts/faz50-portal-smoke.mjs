#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveContactMessage } from '../server/tenantAuth.mjs';
import {
  linkContactFormToMessagingThread,
  lookupPortalSessionByContact,
  getPortalSession,
  buildCustomerPortalUrl,
} from '../server/messaging/customerPortal.mjs';
import { patchMessagingThread } from '../server/messaging/store.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-portal-'));
process.env.EKOLOJIK_PUBLIC_ORIGIN = 'https://shop.test';

try {
  const saved = await saveContactMessage(dir, {
    name: 'Portal Test',
    email: 'portal@test.com',
    subject: 'destek',
    message: 'Merhaba, yardım lazım',
  });
  if (!saved.ok || !saved.contact) throw new Error('contact save');

  const link = await linkContactFormToMessagingThread(dir, 'main', saved.contact, {
    origin: 'https://shop.test',
  });
  if (!link.ok || !link.portalUrl?.includes('/portal/mesajlar')) {
    throw new Error('portal link');
  }

  const lookup = await lookupPortalSessionByContact(
    dir,
    'main',
    { reference: saved.contact.id, email: saved.contact.email },
    { origin: 'https://shop.test' },
  );
  if (!lookup.ok || !lookup.token) throw new Error('lookup');

  const session = await getPortalSession(dir, 'main', lookup.token);
  if (!session.ok || !session.thread?.id) throw new Error('session');
  if (!Array.isArray(session.messages) || session.messages.length < 1) {
    throw new Error('messages');
  }

  const url = buildCustomerPortalUrl('https://shop.test', 'main', lookup.token);
  if (!url.includes('token=')) throw new Error('url token');

  const patched = await patchMessagingThread(dir, 'main', session.thread.id, { status: 'waiting' });
  if (!patched.ok || patched.thread.status !== 'waiting') throw new Error('status patch');

  console.log('OK    contact→thread, portal session, lookup, status');
  console.log('\nFaz 50 portal smoke: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
