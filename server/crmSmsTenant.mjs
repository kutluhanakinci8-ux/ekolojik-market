/** Kiracı bazlı CRM SMS yapılandırması + gönderim audit */

import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCrmSmsConfig } from './crmSms.mjs';

function tenantConfigPath(dataDir, tenantId) {
  return join(dataDir, 'crm-sms', `${tenantId}.json`);
}

function auditPath(dataDir, tenantId) {
  return join(dataDir, 'crm-sms', `audit-${tenantId}.jsonl`);
}

export async function readTenantCrmSmsOverride(dataDir, tenantId = 'main') {
  try {
    const raw = JSON.parse(await readFile(tenantConfigPath(dataDir, tenantId), 'utf8'));
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

/** Env + isteğe bağlı tenant dosyası (tenant alanları env’i override eder) */
export async function getEffectiveCrmSmsConfig(dataDir, tenantId = 'main') {
  const base = getCrmSmsConfig();
  const override = await readTenantCrmSmsOverride(dataDir, tenantId);
  if (!override) return { ...base, tenantId, source: 'env' };
  return {
    provider: String(override.provider ?? base.provider).trim().toLowerCase(),
    user: String(override.user ?? base.user).trim(),
    pass: String(override.pass ?? base.pass).trim(),
    header: String(override.header ?? base.header).trim(),
    httpUrl: String(override.httpUrl ?? base.httpUrl).trim(),
    tenantId,
    source: 'tenant',
  };
}

export async function appendCrmSmsAudit(dataDir, tenantId, entry) {
  const dir = join(dataDir, 'crm-sms');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), tenantId, ...entry }) + '\n';
  await appendFile(auditPath(dataDir, tenantId), line, 'utf8');
}
