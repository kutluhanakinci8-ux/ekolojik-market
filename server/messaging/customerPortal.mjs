import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createMessagingThread,
  getMessagingThread,
  listMessagingMessages,
  listMessagingThreads,
} from './store.mjs';
import { mintCustomerThreadToken, parseCustomerThreadToken } from './publicApi.mjs';
import { sendEkolojikMail } from '../emailOutboxProcessor.mjs';
import { appendCustomerTrackingNotice } from '../postaCustomerEmailCompliance.mjs';
function isMessagingCustomerEmailEnabled() {
  return process.env.EKOLOJIK_MESSAGING_CUSTOMER_EMAIL === '1';
}

const SUBJECT_LABELS = {
  genel: 'Genel',
  siparis: 'Sipariş',
  bayi: 'Bayi / Toptan',
  sikayet: 'Şikayet',
  diger: 'Diğer',
  demo: 'Demo',
  fiyat: 'Fiyatlandırma',
  destek: 'Destek',
};

function subjectLabel(code) {
  const key = String(code ?? 'genel').trim().toLowerCase();
  return SUBJECT_LABELS[key] ?? code ?? 'Genel';
}

export function contactMessagingCustomerId(contactId) {
  return `contact-${String(contactId).trim()}`;
}

export function resolvePublicPortalOrigin(req) {
  const env = String(process.env.EKOLOJIK_PUBLIC_ORIGIN ?? '').trim();
  if (env) return env.replace(/\/$/, '');
  const host = String(req?.headers?.['x-forwarded-host'] ?? req?.headers?.host ?? '').trim();
  const proto = String(req?.headers?.['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  return 'http://localhost:5180';
}

export function buildCustomerPortalUrl(origin, tenantId, token) {
  const q = new URLSearchParams({ token });
  if (tenantId && tenantId !== 'main') q.set('tenant', tenantId);
  const base = String(origin ?? '').replace(/\/$/, '');
  return `${base}/portal/mesajlar?${q.toString()}`;
}

async function readContactItems(dataDir) {
  try {
    const items = JSON.parse(await readFile(join(dataDir, 'contact-messages.json'), 'utf8'));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeContactItems(dataDir, items) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(dataDir, 'contact-messages.json'), JSON.stringify(items, null, 2), 'utf8');
}

export async function patchContactRecord(dataDir, contactId, patch) {
  const items = await readContactItems(dataDir);
  const idx = items.findIndex((r) => r.id === contactId);
  if (idx < 0) return { ok: false, error: 'İletişim kaydı bulunamadı' };
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeContactItems(dataDir, items);
  return { ok: true, contact: items[idx] };
}

export async function findContactByReference(dataDir, reference, email) {
  const ref = String(reference ?? '').trim();
  const mail = String(email ?? '').trim().toLowerCase();
  if (!ref || !mail.includes('@')) return { ok: false, error: 'Referans ve e-posta zorunlu' };
  const items = await readContactItems(dataDir);
  const row = items.find(
    (r) => r.id === ref && String(r.email ?? '').trim().toLowerCase() === mail,
  );
  if (!row) return { ok: false, error: 'Kayıt bulunamadı' };
  return { ok: true, contact: row };
}

export async function ensureContactMessagingThread(dataDir, tenantId, contact) {
  const customerId = contactMessagingCustomerId(contact.id);
  const listed = await listMessagingThreads(dataDir, tenantId, {
    customerId,
    limit: 5,
    includeArchived: true,
  });
  let thread = listed.threads?.[0] ?? null;

  if (!thread) {
    const body = [
      contact.message,
      contact.phone?.trim() ? `\nTelefon: ${contact.phone.trim()}` : '',
    ]
      .join('')
      .trim();
    const created = await createMessagingThread(dataDir, tenantId, {
      customerId,
      customerName: contact.name,
      customerEmail: contact.email,
      subject: `İletişim — ${subjectLabel(contact.subject)}`,
      initialMessage: body,
      initialDirection: 'customer',
      authorName: contact.name,
      channel: 'web',
    });
    if (!created.ok || !created.thread) return created;
    thread = created.thread;
  }

  const token = await mintCustomerThreadToken(dataDir, tenantId, thread.id, customerId);
  return { ok: true, thread, customerId, token };
}

export async function linkContactFormToMessagingThread(dataDir, tenantId, contact, { origin } = {}) {
  const ensured = await ensureContactMessagingThread(dataDir, tenantId, contact);
  if (!ensured.ok || !ensured.thread) return ensured;
  const portalUrl = buildCustomerPortalUrl(origin, tenantId, ensured.token);
  await patchContactRecord(dataDir, contact.id, {
    messagingThreadId: ensured.thread.id,
    portalUrl,
  });
  return {
    ok: true,
    thread: ensured.thread,
    token: ensured.token,
    portalUrl,
    customerId: ensured.customerId,
  };
}

export async function lookupPortalSessionByContact(dataDir, tenantId, { reference, email }, { origin } = {}) {
  const found = await findContactByReference(dataDir, reference, email);
  if (!found.ok) return found;
  const link = await linkContactFormToMessagingThread(dataDir, tenantId, found.contact, { origin });
  if (!link.ok) return link;
  return {
    ok: true,
    token: link.token,
    portalUrl: link.portalUrl,
    threadId: link.thread.id,
  };
}

export async function getPortalSession(dataDir, tenantId, token) {
  const parsed = await parseCustomerThreadToken(dataDir, tenantId, token);
  if (!parsed.ok) return parsed;
  const got = await getMessagingThread(dataDir, tenantId, parsed.threadId);
  if (!got.ok) return got;
  if (got.thread.customerId !== parsed.customerId) {
    return { ok: false, error: 'Thread erişimi reddedildi' };
  }
  const listed = await listMessagingMessages(dataDir, tenantId, parsed.threadId, { limit: 200 });
  return {
    ok: true,
    thread: got.thread,
    messages: listed.messages ?? [],
    token,
  };
}

const STATUS_LABELS = {
  open: 'Açık',
  waiting: 'Beklemede',
  closed: 'Kapalı',
};

export async function notifyCustomerThreadStatusEmail(
  dataDir,
  tenantId,
  thread,
  { previousStatus, origin },
) {
  if (!isMessagingCustomerEmailEnabled()) {
    return { skipped: true, reason: 'customer_email_disabled' };
  }
  const to = thread.customerEmail?.trim();
  if (!to?.includes('@')) return { skipped: true, reason: 'no_email' };
  const status = thread.status ?? 'open';
  if (previousStatus === status) return { skipped: true, reason: 'unchanged' };

  const token = await mintCustomerThreadToken(dataDir, tenantId, thread.id, thread.customerId);
  const portalUrl = buildCustomerPortalUrl(origin, tenantId, token);
  const label = STATUS_LABELS[status] ?? status;
  const subject = `Ekolojik Market — talep durumu: ${label}`;
  const text = [
    `Sayın ${thread.customerName},`,
    '',
    `Yazışma talebinizin durumu güncellendi: ${label}`,
    `Konu: ${thread.subject}`,
    '',
    `Durumu görüntülemek ve mesajlaşmaya devam etmek için:`,
    portalUrl,
    '',
    '— Ekolojik Market',
  ].join('\n');
  const html = `<div style="font-family:sans-serif;font-size:14px">
<p>Sayın ${thread.customerName},</p>
<p>Talep durumu: <strong>${label}</strong></p>
<p>Konu: ${thread.subject}</p>
<p><a href="${portalUrl}">Müşteri portalında görüntüle</a></p>
</div>`;
  const withNotice = await appendCustomerTrackingNotice(dataDir, tenantId, { text, html });
  const idempotencyKey = `portal:status:${thread.id}:${status}:${createHash('sha256')
    .update(`${previousStatus}->${status}`)
    .digest('hex')
    .slice(0, 12)}`;
  const mail = await sendEkolojikMail(dataDir, {
    to,
    subject,
    body: withNotice.text,
    html: withNotice.html,
    idempotencyKey,
    source: 'messaging-portal-status',
    tenantId,
  });
  return { ok: true, mail, portalUrl };
}

export function enrichCustomerMailWithPortalUrl(tpl, portalUrl) {
  if (!portalUrl) return tpl;
  const text = `${tpl.text}\n\nYazışmayı görüntüle:\n${portalUrl}\n`;
  const html = tpl.html.replace(
    '</div>',
    `<p><a href="${portalUrl}">Müşteri portalında görüntüle</a></p></div>`,
  );
  return { ...tpl, text, html };
}

export async function buildPortalUrlForThread(dataDir, tenantId, thread, origin) {
  const token = await mintCustomerThreadToken(dataDir, tenantId, thread.id, thread.customerId);
  return buildCustomerPortalUrl(origin, tenantId, token);
}
