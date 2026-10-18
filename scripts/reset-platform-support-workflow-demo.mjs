#!/usr/bin/env node
/**
 * Platform destek — demo iş akışı: eski açık kayıtları kapat, tek şifre/giriş talebi aç.
 *
 *   node scripts/reset-platform-support-workflow-demo.mjs --data-dir /var/www/market-pos/data
 *   node scripts/reset-platform-support-workflow-demo.mjs --data-dir ./data --origin https://168.231.109.27:5180
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const LOGIN_MESSAGE = `Merhaba Ekolojik Destek,

Greenleaf Market (main) mağazasından yazıyoruz.

İlk giriş denemesinde kasiyer kullanıcımız POS'a giriş yapamıyor; "Geçersiz kullanıcı adı veya şifre" uyarısı alıyoruz. Şifreyi doğru girdiğimizden eminiz.

Hesap kilidi veya şifre sıfırlama konusunda yardım rica ederiz.

Teşekkürler,
Greenleaf Market`;

const DEMO = {
  tenantId: 'main',
  businessName: 'Greenleaf Market',
  subject: 'İlk giriş: kullanıcı POS\'a giremiyor',
  requesterName: 'Greenleaf Market',
  requesterEmail: process.env.DEMO_SUPPORT_REQUESTER_EMAIL || 'magaza@greenleaf-demo.local',
  kind: 'incident',
  priority: 'high',
  tags: ['contact-form', 'greenleaf-demo', 'giris', 'guvenlik'],
};

function parseArgs(argv) {
  let dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
  let origin = process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:5180';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--data-dir' && argv[i + 1]) dataDir = argv[++i];
    else if (argv[i] === '--origin' && argv[i + 1]) origin = argv[++i];
  }
  return { dataDir, origin };
}

async function main() {
  const { dataDir, origin } = parseArgs(process.argv);
  const { readPlatformCases, updatePlatformCase, createPlatformCase, appendCaseActivity } = await import(
    '../server/platformCaseStore.mjs'
  );

  const cases = await readPlatformCases(dataDir);
  let closed = 0;
  for (const row of cases) {
    if (row.status === 'closed' || row.status === 'solved') continue;
    await updatePlatformCase(dataDir, row.id, { status: 'closed' }, 'system-demo-reset');
    await appendCaseActivity(
      dataDir,
      row.id,
      {
        type: 'case_updated',
        body: 'Operatör demo temizliği: kayıt kapatıldı (yeni iş akışı testi).',
        channel: 'internal',
      },
      'system-demo-reset',
    );
    closed += 1;
  }

  const contactPath = join(dataDir, 'contact-messages.json');
  let contacts = [];
  try {
    contacts = JSON.parse(await readFile(contactPath, 'utf8'));
  } catch {
    contacts = [];
  }
  if (!Array.isArray(contacts)) contacts = [];

  const contactId = `C-workflow-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const contact = {
    id: contactId,
    tenantId: DEMO.tenantId,
    name: DEMO.requesterName,
    email: DEMO.requesterEmail,
    phone: '',
    subject: DEMO.subject,
    message: LOGIN_MESSAGE,
    createdAt,
  };
  contacts.unshift(contact);
  await writeFile(contactPath, JSON.stringify(contacts, null, 2), 'utf8');

  const created = await createPlatformCase(
    dataDir,
    {
      kind: DEMO.kind,
      channel: 'contact_form',
      status: 'new',
      priority: DEMO.priority,
      tenantId: DEMO.tenantId,
      businessName: DEMO.businessName,
      subject: DEMO.subject,
      requesterName: DEMO.requesterName,
      requesterEmail: DEMO.requesterEmail,
      links: { contactMessageId: contactId, tenantId: DEMO.tenantId },
      tags: DEMO.tags,
      notes: `Form mesajı:\n${LOGIN_MESSAGE}`,
    },
    'system-demo-reset',
  );

  const caseRow = created.case ?? created;
  await appendCaseActivity(
    dataDir,
    caseRow.id,
    {
      type: 'note',
      body: 'Demo: müşteri şifreli giriş sorunu bildirdi — operatör yanıtı e-posta veya mesajlaşma kanalından test edilebilir.',
      channel: 'internal',
    },
    'system-demo-reset',
  );

  let portalUrl = null;
  try {
    const { linkContactFormToMessagingThread } = await import('../server/messaging/customerPortal.mjs');
    const link = await linkContactFormToMessagingThread(dataDir, DEMO.tenantId, contact, { origin });
    if (link.ok) {
      portalUrl = link.portalUrl;
      await updatePlatformCase(
        dataDir,
        caseRow.id,
        { links: { tenantId: DEMO.tenantId, threadId: link.thread.id, contactMessageId: contactId } },
        'system-demo-reset',
      );
    }
  } catch (err) {
    console.warn('Portal thread bağlantısı atlandı:', err?.message ?? err);
  }

  console.log(`OK   ${closed} açık kayıt kapatıldı`);
  console.log(`OK   Yeni talep #${caseRow.number} (${caseRow.id})`);
  console.log(`     Konu: ${DEMO.subject}`);
  console.log(`     Kiracı: ${DEMO.tenantId} · ${DEMO.businessName}`);
  console.log(`     İstek sahibi: ${DEMO.requesterEmail}`);
  if (portalUrl) {
    console.log(`     Müşteri portal (mesajlaşma yanıtları): ${portalUrl}`);
  } else {
    console.log('     Not: Müşteri portal URL üretilemedi — yanıt için operatör e-posta kanalını kullanın.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
