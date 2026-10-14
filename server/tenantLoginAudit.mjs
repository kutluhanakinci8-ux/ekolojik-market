/** Kiracı store.json — sunucu tarafı giriş denetim kaydı (platform 360) */

import { randomUUID } from 'node:crypto';
import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';

const MAX_ENTRIES = 200;

export function buildLoginAuditRecord(partial) {
  const username = String(partial.username ?? '').trim().toLowerCase();
  return {
    id: partial.id ?? `LA-${randomUUID()}`,
    sessionId: partial.sessionId ?? undefined,
    userId: partial.userId ?? undefined,
    username,
    displayName: partial.displayName ? String(partial.displayName).trim() : undefined,
    success: partial.success === true,
    method: partial.method === 'pin' ? 'pin' : 'password',
    deviceInfo: String(partial.deviceInfo ?? 'web').slice(0, 200),
    clientIp: partial.clientIp ? String(partial.clientIp).trim() : undefined,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    failureReason: partial.failureReason ? String(partial.failureReason).slice(0, 240) : undefined,
  };
}

export async function appendTenantLoginAudit(dataDir, tenantId, partial) {
  const tenant = String(tenantId ?? 'main').trim() || 'main';
  const store = await readTenantStore(dataDir, tenant);
  if (!store) return { ok: false, error: 'store_missing' };

  const record = buildLoginAuditRecord(partial);
  const log = Array.isArray(store.loginAuditLog) ? store.loginAuditLog : [];
  log.unshift(record);
  store.loginAuditLog = log.slice(0, MAX_ENTRIES);
  await writeTenantStore(dataDir, tenant, store);
  return { ok: true, entry: record };
}
