#!/usr/bin/env node
/**
 * VPS / yerel: POS Lite tenant oluştur (Lima gibi — stok + satış, izole store.json)
 *
 * Örnek:
 *   node scripts/provision-pos-lite-tenant.mjs \
 *     --data-dir /var/www/market-pos/data \
 *     --business "Lima Market" \
 *     --email info@lima.example \
 *     --phone 05000000000 \
 *     --admin "Lima Yönetici" \
 *     --username limaadmin \
 *     --password 'GucluSifre123'
 */
import { join } from 'node:path';
import { registerTenant } from '../server/tenantAuth.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const payload = {
  businessName: arg('business'),
  email: arg('email'),
  phone: arg('phone'),
  adminName: arg('admin'),
  username: arg('username'),
  password: arg('password'),
  plan: 'pos-lite',
  productProfile: 'pos-lite',
};

if (!payload.businessName || !payload.email || !payload.adminName || !payload.username || payload.password.length < 6) {
  console.error('Zorunlu: --business --email --admin --username --password (min 6)');
  process.exit(1);
}

const result = await registerTenant(dataDir, payload);
if (!result.ok) {
  console.error(result.message ?? 'Kayıt başarısız');
  process.exit(1);
}

console.log('OK   POS Lite tenant oluşturuldu');
console.log(`     tenantId (Mağaza Kodu): ${result.tenantId}`);
console.log(`     kullanıcı: ${result.username}`);
console.log(`     giriş: /giris?tenant=${encodeURIComponent(result.tenantId ?? '')}`);
console.log(`     veri: ${join(dataDir, 'tenants', result.tenantId ?? '', 'store.json')}`);
