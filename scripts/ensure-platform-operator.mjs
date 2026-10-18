#!/usr/bin/env node
/**
 * Platform operatörü (kutluhan08) — Greenleaf store.json dışında, _platform vault.
 *
 *   GREENLEAF_OWNER_PASSWORD='...' node scripts/ensure-platform-operator.mjs --data-dir /var/www/market-pos/data
 *
 * İsteğe bağlı: GREENLEAF_OWNER_RECOVERY_EMAIL
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { upsertPlatformOperator } from '../server/platformAuth.mjs';

const dataDir = process.argv.includes('--data-dir')
  ? process.argv[process.argv.indexOf('--data-dir') + 1]
  : join(process.cwd(), 'data');

const password = process.env.PLATFORM_OPERATOR_PASSWORD?.trim()
  || process.env.GREENLEAF_OWNER_PASSWORD?.trim();
if (!password) {
  console.error('HATA: PLATFORM_OPERATOR_PASSWORD veya GREENLEAF_OWNER_PASSWORD gerekli.');
  process.exit(1);
}

const recoveryEmail = process.env.GREENLEAF_OWNER_RECOVERY_EMAIL?.trim().toLowerCase();

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

await upsertPlatformOperator(dataDir, {
  username: 'kutluhan08',
  passwordHash: sha256(password),
  recoveryEmail,
  displayName: 'Ekolojik Platform',
});

const storePath = join(dataDir, 'store.json');
try {
  const raw = JSON.parse(await readFile(storePath, 'utf8'));
  const users = (raw.users ?? []).filter((u) => {
    const name = String(u.username ?? '').toLowerCase();
    return !['kutluhan08', 'kutluhan', 'kutluhanakinci8'].includes(name);
  });
  if (users.length !== (raw.users ?? []).length) {
    await writeFile(
      storePath,
      JSON.stringify({ ...raw, users, updatedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
    console.log('OK platform operator vault; kutluhan* Greenleaf store.json listesinden çıkarıldı');
  } else {
    console.log('OK platform operator vault');
  }
} catch {
  console.log('OK platform operator vault (store.json yok veya okunamadı)');
}
