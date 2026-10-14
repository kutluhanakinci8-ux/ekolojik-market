#!/usr/bin/env node
/** Tek seferlik: #19 Greenleaf giriş mesajını güncelle */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = process.argv.includes('--data-dir')
  ? process.argv[process.argv.indexOf('--data-dir') + 1]
  : '/var/www/market-pos/data';

const msg = `Merhaba Ekolojik Destek,

Greenleaf Market (main) mağazasından yazıyoruz.

İlk giriş denemesinde kasiyer kullanıcımız POS'a giriş yapamıyor; "Geçersiz kullanıcı adı veya şifre" uyarısı alıyoruz. Şifreyi doğru girdiğimizden eminiz.

Hesap kilidi veya şifre sıfırlama konusunda yardım rica ederiz.

Teşekkürler,
Greenleaf Market`;

const subject = "İlk giriş: kullanıcı POS'a giremiyor";

const casesPath = join(dataDir, 'platform', 'support-cases.json');
const store = JSON.parse(await readFile(casesPath, 'utf8'));
const c = store.cases.find((x) => Number(x.number) === 19);
if (!c) {
  console.error('#19 bulunamadı');
  process.exit(1);
}
c.subject = subject;
c.notes = `Form mesajı:\n${msg}`;
c.status = 'new';
c.kind = 'incident';
c.priority = 'high';
c.tenantId = 'main';
c.businessName = 'Greenleaf Market';
c.requesterName = 'Greenleaf Market';
c.updatedAt = new Date().toISOString();
const cid = c.links?.contactMessageId;
const contactPath = join(dataDir, 'contact-messages.json');
const contacts = JSON.parse(await readFile(contactPath, 'utf8'));
const ci = contacts.findIndex((x) => x.id === cid);
if (ci >= 0) {
  contacts[ci].subject = subject;
  contacts[ci].message = msg;
  contacts[ci].name = 'Greenleaf Market';
  contacts[ci].tenantId = 'main';
}
await writeFile(casesPath, JSON.stringify(store, null, 2));
await writeFile(contactPath, JSON.stringify(contacts, null, 2));
console.log('OK #19:', subject);
