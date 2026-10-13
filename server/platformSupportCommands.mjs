/** Destek komut paleti — yaşam döngüsü ve posta kuyruğu */

import { normalizeTenantId } from './tenantAllowlist.mjs';
import { updatePlatformTenantLifecycle } from './platformTenantLifecycle.mjs';

const COMMAND_ALIASES = {
  suspend: ['suspend', 'askiya', 'askıya', 'askiya_al', 'askiya_al', 'askiyaal'],
  unsuspend: ['unsuspend', 'aktif', 'ac', 'aç', 'kaldir', 'kaldır'],
  read_only_on: ['read_only', 'readonly', 'salt_okunur', 'salt-okunur'],
  read_only_off: ['read_write', 'yazma', 'salt_okunur_kapat'],
  requeue_outbox: ['requeue', 'requeue_outbox', 'outbox', 'outbox_requeue', 'kuyruk_yenile'],
};

function normalizeCommand(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  for (const [canonical, aliases] of Object.entries(COMMAND_ALIASES)) {
    if (aliases.includes(s) || canonical === s) return canonical;
  }
  return s;
}

/** "lima askıya al" → { tenantId: 'lima', command: 'suspend' } when tenantId omitted */
export function parseSupportCommandLine(line, defaultTenantId) {
  const text = String(line ?? '').trim();
  if (!text) return { ok: false, error: 'Komut boş' };
  const withoutSlash = text.startsWith('/') ? text.slice(1).trim() : text;
  const parts = withoutSlash.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'Komut boş' };

  let tenantId = defaultTenantId ? normalizeTenantId(defaultTenantId) : null;
  let cmdPart = parts[0];

  if (!tenantId && parts.length >= 2) {
    tenantId = normalizeTenantId(parts[0]);
    cmdPart = parts.slice(1).join(' ');
  } else if (parts.length >= 2) {
    cmdPart = parts.join(' ');
  }

  const command = normalizeCommand(cmdPart.replace(/\s+al$/i, '').replace(/\s+/g, '_'));
  if (!tenantId) return { ok: false, error: 'Kiracı seçin veya komutta tenantId yazın (örn. lima askıya)' };
  return { ok: true, tenantId, command };
}

export async function runPlatformSupportCommand(dataDir, { tenantId, command, line }, operatorUsername) {
  let resolvedTenant = tenantId ? normalizeTenantId(tenantId) : null;
  let resolvedCommand = normalizeCommand(command);

  if (line) {
    const parsed = parseSupportCommandLine(line, resolvedTenant);
    if (!parsed.ok) return parsed;
    resolvedTenant = parsed.tenantId;
    resolvedCommand = parsed.command;
  }

  if (!resolvedTenant) return { ok: false, error: 'Kiracı gerekli' };

  switch (resolvedCommand) {
    case 'suspend':
      return updatePlatformTenantLifecycle(dataDir, resolvedTenant, { suspended: true }, operatorUsername);
    case 'unsuspend':
      return updatePlatformTenantLifecycle(dataDir, resolvedTenant, { suspended: false }, operatorUsername);
    case 'read_only_on':
      return updatePlatformTenantLifecycle(dataDir, resolvedTenant, { readOnly: true }, operatorUsername);
    case 'read_only_off':
      return updatePlatformTenantLifecycle(dataDir, resolvedTenant, { readOnly: false }, operatorUsername);
    case 'requeue_outbox': {
      const { bulkRequeueFailedOutbox } = await import('./emailOutbox.mjs');
      const result = await bulkRequeueFailedOutbox(dataDir, { tenantId: resolvedTenant, all: true, ids: [] });
      return { ok: true, ...result, tenantId: resolvedTenant };
    }
    default:
      return {
        ok: false,
        error: 'Bilinmeyen komut',
        hints: ['suspend', 'unsuspend', 'read_only', 'requeue_outbox'],
      };
  }
}

export function listPlatformSupportCommands() {
  return [
    { id: 'suspend', label: 'Askıya al', example: '/suspend veya lima askıya' },
    { id: 'unsuspend', label: 'Askıdan çıkar', example: '/unsuspend' },
    { id: 'read_only_on', label: 'Salt okunur', example: '/read_only' },
    { id: 'read_only_off', label: 'Yazmaya aç', example: '/read_write' },
    { id: 'requeue_outbox', label: 'Başarısız outbox yeniden kuyruk', example: '/requeue_outbox' },
  ];
}
