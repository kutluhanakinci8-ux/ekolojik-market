import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getEkolojikImapConfig, getEkolojikMailConfig, isEkolojikImapConfigured, isEkolojikSmtpConfigured } from './ekolojikMailConfig.mjs';

function configPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'tenant-mail', `${tenantId}.json`);
}

const SECRET_MASK = '••••••••';

async function readRaw(dataDir, tenantId) {
  try {
    return JSON.parse(await readFile(configPath(dataDir, tenantId), 'utf8'));
  } catch {
    return null;
  }
}

export async function getTenantMailConfigHub(dataDir, tenantId = 'main') {
  const raw = await readRaw(dataDir, tenantId);
  const usePlatformEnv = raw?.usePlatformEnv !== false;
  const envMail = getEkolojikMailConfig();
  const envImap = getEkolojikImapConfig();
  const smtp = raw?.smtp ?? {};
  const imap = raw?.imap ?? {};
  return {
    ok: true,
    tenantId,
    usePlatformEnv,
    enabled: raw?.enabled !== false,
    smtp: {
      host: smtp.host ?? '',
      port: smtp.port ?? null,
      secure: smtp.secure ?? null,
      user: smtp.user ?? '',
      pass: smtp.pass ? SECRET_MASK : '',
      from: smtp.from ?? '',
      fromName: smtp.fromName ?? '',
      replyTo: smtp.replyTo ?? '',
    },
    imap: {
      host: imap.host ?? '',
      port: imap.port ?? null,
      secure: imap.secure ?? null,
      user: imap.user ?? '',
      pass: imap.pass ? SECRET_MASK : '',
      inboxAddress: imap.inboxAddress ?? '',
    },
    effective: {
      smtpConfigured: usePlatformEnv ? isEkolojikSmtpConfigured() : Boolean((smtp.host || envMail.smtpHost) && (smtp.from || envMail.from)),
      imapConfigured: await isTenantImapConfigured(dataDir, tenantId),
      smtpFrom: usePlatformEnv ? envMail.from : smtp.from || envMail.from,
      imapUser: usePlatformEnv ? envImap.imapUser : imap.user || envImap.imapUser,
    },
    updatedAt: raw?.updatedAt ?? null,
  };
}

export async function saveTenantMailConfig(dataDir, tenantId, patch = {}) {
  const current = (await readRaw(dataDir, tenantId)) ?? {
    usePlatformEnv: true,
    enabled: true,
    smtp: {},
    imap: {},
  };
  const now = new Date().toISOString();
  await mkdir(join(dataDir, 'tenant-mail'), { recursive: true });

  const usePlatformEnv = patch.usePlatformEnv !== undefined ? Boolean(patch.usePlatformEnv) : current.usePlatformEnv !== false;
  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled !== false;

  const mergeBlock = (prev, next) => {
    const base = { ...(prev ?? {}) };
    if (!next || typeof next !== 'object') return base;
    for (const [key, val] of Object.entries(next)) {
      if (val === undefined) continue;
      if (key === 'pass' && (val === '' || val === SECRET_MASK)) continue;
      base[key] = val;
    }
    return base;
  };

  const next = {
    usePlatformEnv,
    enabled,
    smtp: mergeBlock(current.smtp, patch.smtp),
    imap: mergeBlock(current.imap, patch.imap),
    updatedAt: now,
  };
  await writeFile(configPath(dataDir, tenantId), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, config: next };
}

export async function getTenantImapConfig(dataDir, tenantId = 'main') {
  const env = getEkolojikImapConfig();
  const raw = await readRaw(dataDir, tenantId);
  if (!raw || raw.usePlatformEnv !== false || raw.enabled === false) {
    return env;
  }
  const imap = raw.imap ?? {};
  return {
    imapHost: String(imap.host ?? '').trim() || env.imapHost,
    imapPort: imap.port != null ? Number(imap.port) : env.imapPort,
    imapSecure: imap.secure != null ? Boolean(imap.secure) : env.imapSecure,
    imapUser: String(imap.user ?? '').trim() || env.imapUser,
    imapPassword: imap.pass != null && String(imap.pass) !== '' ? String(imap.pass) : env.imapPassword,
    inboxAddress: String(imap.inboxAddress ?? '').trim() || env.inboxAddress,
  };
}

export async function isTenantImapConfigured(dataDir, tenantId = 'main') {
  const c = await getTenantImapConfig(dataDir, tenantId);
  return Boolean(c.imapHost && c.imapUser && c.imapPassword);
}

export async function getTenantSmtpMailConfig(dataDir, tenantId = 'main') {
  const env = getEkolojikMailConfig();
  const raw = await readRaw(dataDir, tenantId);
  if (!raw || raw.usePlatformEnv !== false || raw.enabled === false) {
    return env;
  }
  const smtp = raw.smtp ?? {};
  return {
    smtpHost: String(smtp.host ?? '').trim() || env.smtpHost,
    smtpPort: smtp.port != null ? Number(smtp.port) : env.smtpPort,
    smtpSecure: smtp.secure != null ? Boolean(smtp.secure) : env.smtpSecure,
    smtpUser: String(smtp.user ?? '').trim() || env.smtpUser,
    smtpPass: smtp.pass != null && String(smtp.pass) !== '' ? String(smtp.pass) : env.smtpPass,
    from: String(smtp.from ?? '').trim() || env.from,
    fromName: String(smtp.fromName ?? '').trim() || env.fromName,
    replyTo: String(smtp.replyTo ?? '').trim() || env.replyTo,
  };
}
