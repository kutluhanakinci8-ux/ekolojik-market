#!/usr/bin/env node
/**
 * Yerel smoke: store.json üzerinden Posta yetkili kullanıcı için Bearer token üretir.
 * Sadece VPS/CI aynı makinede çalışırken — uzaktan API ile şifre bilinmiyorsa.
 * Kullanım: node scripts/lib/mint-posta-qa-token.mjs /var/www/market-pos/data
 */
import { readTenantStore } from '../../server/tenantAuth.mjs';
import { createPosApiToken } from '../../server/posApiAuth.mjs';

const dataDir = process.argv[2]?.trim();
if (!dataDir) {
  console.error('dataDir gerekli');
  process.exit(2);
}

const store = await readTenantStore(dataDir, 'main');
if (!store?.users?.length) {
  process.exit(3);
}

const candidates = store.users.filter(
  (u) => u.isActive !== false && Array.isArray(u.allowedTabs) && u.allowedTabs.includes('posta'),
);
const user =
  candidates.find((u) => u.role === 'admin') ??
  candidates[0] ??
  store.users.find((u) => u.isActive !== false && u.role === 'admin');

if (!user) {
  process.exit(4);
}

const token = await createPosApiToken(dataDir, {
  tenantId: 'main',
  userId: user.id,
  role: user.role,
});
process.stdout.write(JSON.stringify({ token, username: user.username, userId: user.id }));
