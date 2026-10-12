import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_KEEP = 48;

/**
 * Her başarılı tenant store yazımından sonra — mağaza bazlı dönen JSON yedek.
 * data/backups/auto-tenant/<tenantId>/store-<timestamp>.json
 */
export async function archiveTenantStoreAfterWrite(dataDir, tenantId, store) {
  if (!store || typeof store !== 'object') return;
  const tid = String(tenantId || 'main').trim() || 'main';
  const dir = join(dataDir, 'backups', 'auto-tenant', tid);
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `store-${stamp}.json`);
  await writeFile(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8');

  const keep = Math.max(
    5,
    Number.parseInt(process.env.TENANT_AUTO_BACKUP_KEEP || '', 10) || DEFAULT_KEEP,
  );
  let names = [];
  try {
    names = (await readdir(dir))
      .filter((name) => name.startsWith('store-') && name.endsWith('.json'))
      .sort();
  } catch {
    return;
  }
  while (names.length > keep) {
    const old = names.shift();
    if (old) await unlink(join(dir, old)).catch(() => {});
  }
}
