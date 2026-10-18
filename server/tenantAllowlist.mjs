import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore } from './tenantAuth.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');

let cachedAllowlist = null;

async function loadAllowlistFromConfig() {
  if (cachedAllowlist) return cachedAllowlist;
  try {
    const raw = await readFile(join(REPO_ROOT, 'config', 'known-tenants.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const fromFile = Array.isArray(parsed.allowlist) ? parsed.allowlist.map((s) => String(s).trim()) : [];
    cachedAllowlist = fromFile.length ? fromFile : ['main', 'lima-market'];
  } catch {
    cachedAllowlist = ['main', 'lima-market'];
  }
  return cachedAllowlist;
}

export function normalizeTenantId(raw) {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t || t === 'default' || t === 'greenleaf') return 'main';
  return t;
}

export function isStrictTenantAllowlistEnabled() {
  if (process.env.EKOLOJIK_TENANT_STRICT === '0') return false;
  if (process.env.EKOLOJIK_TENANT_STRICT === '1') return true;
  return process.env.NODE_ENV === 'production';
}

export async function getTenantAllowlist() {
  const envList = process.env.EKOLOJIK_TENANT_ALLOWLIST?.trim();
  if (envList) {
    return envList.split(',').map((s) => normalizeTenantId(s)).filter(Boolean);
  }
  return loadAllowlistFromConfig();
}

export async function isTenantAllowlisted(tenantId) {
  const id = normalizeTenantId(tenantId);
  const list = await getTenantAllowlist();
  return list.includes(id);
}

/**
 * Prod: bilinmeyen tenant için store yoksa 404.
 * Dev: serbest (kayıt / test tenant).
 */
export async function assertTenantResolvable(dataDir, tenantId) {
  const id = normalizeTenantId(tenantId);
  if (id === '__platform__') return { ok: true, tenantId: id };
  if (!isStrictTenantAllowlistEnabled()) {
    return { ok: true, tenantId: id };
  }
  if (id === 'main') return { ok: true, tenantId: id };
  if (await isTenantAllowlisted(id)) {
    const store = await readTenantStore(dataDir, id);
    if (!store) {
      return {
        ok: false,
        status: 404,
        error: 'Mağaza verisi bulunamadı. Mağaza kodunu kontrol edin.',
      };
    }
    return { ok: true, tenantId: id };
  }
  const store = await readTenantStore(dataDir, id);
  if (store) return { ok: true, tenantId: id };
  return {
    ok: false,
    status: 404,
    error: 'Geçersiz mağaza kodu. Greenleaf için boş; Lima için lima-market kullanın.',
  };
}

export function isPublicTenantRegistrationEnabled() {
  if (process.env.EKOLOJIK_PUBLIC_REGISTER === '1') return true;
  if (process.env.EKOLOJIK_PUBLIC_REGISTER === '0') return false;
  return process.env.NODE_ENV !== 'production';
}
