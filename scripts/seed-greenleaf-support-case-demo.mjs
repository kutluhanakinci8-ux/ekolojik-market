#!/usr/bin/env node
/**
 * Greenleaf (main) — platform destek demo talebi (#17 veya --case-number).
 * Kiracı 360 verileriyle uyumlu örnek: düşük stok, gecikmiş ödeme, güvenlik uyarısı.
 *
 *   node scripts/seed-greenleaf-support-case-demo.mjs --data-dir /var/www/market-pos/data
 *   node scripts/seed-greenleaf-support-case-demo.mjs --data-dir ./data --case-number 17
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEMO_MESSAGE = `Merhaba Ekolojik Destek,

Greenleaf Market (main) mağaza yöneticisinden yazıyorum. POS ve kiracı panelinde şu uyarılar birikti; demo mağazamızda gerçekten bu metrikleri görüyoruz:

1) Stok: 104 ürün düşük stokta. CARICH diş fırçası varyantları ve GREENLEAF hediye kutusu SKU'ları kasada 0 — satışı durdurduk.
2) Muhasebe: Panelde 9 gecikmiş ödeme (toplam ₺80.019) görünüyor; ödeme yapıldığını düşünüyoruz, kayıt güncellenmemiş olabilir.
3) Güvenlik: Son 30 günde 21 başarısız giriş denemesi ve düşük güven skoru uyarısı aldık; kasiyer hesabı kilitlendi mi kontrol edebilir misiniz?

Stok senkronu ve muhasebe durumu için destek rica ediyoruz.

Teşekkürler,
Greenleaf Mağaza Ekibi`;

const DEMO = {
  tenantId: 'main',
  businessName: 'Greenleaf Market',
  subject: 'Acil: kritik stok sıfır + muhasebe/güvenlik uyarıları',
  requesterName: 'Greenleaf Mağaza Yöneticisi',
  requesterEmail: 'magaza@greenleaf-demo.local',
  kind: 'incident',
  priority: 'high',
  tags: ['contact-form', 'greenleaf-demo', 'stok', 'muhasebe'],
};

function parseArgs(argv) {
  let dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
  let caseNumber = 17;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--data-dir' && argv[i + 1]) dataDir = argv[++i];
    else if (argv[i] === '--case-number' && argv[i + 1]) caseNumber = Number(argv[++i]);
  }
  return { dataDir, caseNumber };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const { dataDir, caseNumber } = parseArgs(process.argv);
  const casesPath = join(dataDir, 'platform', 'support-cases.json');
  const contactPath = join(dataDir, 'contact-messages.json');

  const store = await readJson(casesPath, { cases: [] });
  const cases = Array.isArray(store.cases) ? store.cases : [];
  const idx = cases.findIndex((c) => Number(c.number) === caseNumber);
  if (idx < 0) {
    console.error(`Kayıt #${caseNumber} bulunamadı (${casesPath})`);
    process.exit(1);
  }

  const row = cases[idx];
  const contactId = row.links?.contactMessageId;
  const contacts = await readJson(contactPath, []);
  const list = Array.isArray(contacts) ? contacts : [];
  const cIdx = contactId ? list.findIndex((c) => c.id === contactId) : -1;

  if (cIdx >= 0) {
    list[cIdx] = {
      ...list[cIdx],
      tenantId: DEMO.tenantId,
      name: DEMO.requesterName,
      email: DEMO.requesterEmail,
      subject: DEMO.subject,
      message: DEMO_MESSAGE,
    };
  } else {
    const newId = contactId || `C-greenleaf-demo-${caseNumber}`;
    const createdAt = row.createdAt || new Date().toISOString();
    list.unshift({
      id: newId,
      tenantId: DEMO.tenantId,
      name: DEMO.requesterName,
      email: DEMO.requesterEmail,
      phone: '',
      subject: DEMO.subject,
      message: DEMO_MESSAGE,
      createdAt,
    });
    if (!row.links) row.links = {};
    row.links.contactMessageId = newId;
    row.links.tenantId = DEMO.tenantId;
  }

  row.tenantId = DEMO.tenantId;
  row.businessName = DEMO.businessName;
  row.subject = DEMO.subject;
  row.requesterName = DEMO.requesterName;
  row.requesterEmail = DEMO.requesterEmail;
  row.kind = DEMO.kind;
  row.priority = DEMO.priority;
  row.tags = DEMO.tags;
  row.notes = `Form mesajı:\n${DEMO_MESSAGE}`;
  row.updatedAt = new Date().toISOString();

  cases[idx] = row;
  await writeFile(casesPath, JSON.stringify({ updatedAt: new Date().toISOString(), cases }, null, 2), 'utf8');
  await writeFile(contactPath, JSON.stringify(list, null, 2), 'utf8');

  console.log(`OK   #${caseNumber} Greenleaf demo talebi güncellendi`);
  console.log(`     Kiracı: ${DEMO.tenantId} · ${DEMO.businessName}`);
  console.log(`     Konu: ${DEMO.subject}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
