#!/usr/bin/env node
/**
 * Faz 3 — mevcut tenant store dosyalarında posta sekmesi + onboarding migrasyonu.
 * Kullanım: node scripts/migrate-posta-onboarding.mjs [/var/www/market-pos/data]
 */
import { join } from 'node:path';
import { listTenantIds, readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { migrateLegacyPostaOnboarding } from '../server/postaOnboarding.mjs';

const dataDir = process.argv[2] ? join(process.argv[2]) : join(process.cwd(), 'data');

async function migrateOne(tenantId) {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store) {
    console.log(`  ${tenantId}: store yok, atlandı`);
    return;
  }
  const { store: next, changed } = migrateLegacyPostaOnboarding(store);
  if (!changed) {
    console.log(`  ${tenantId}: zaten güncel`);
    return;
  }
  await writeTenantStore(dataDir, tenantId, next);
  const admins = (next.users ?? []).filter((u) => u.role === 'admin' && u.allowedTabs?.includes('posta'));
  console.log(`  ${tenantId}: migrasyon OK — posta sekmeli admin: ${admins.length}`);
}

async function main() {
  console.log(`==> Posta onboarding migrasyonu: ${dataDir}`);
  const tenantIds = ['main', ...(await listTenantIds(dataDir))];
  const unique = [...new Set(tenantIds)];
  for (const id of unique) {
    await migrateOne(id);
  }
  console.log('==> Bitti');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
