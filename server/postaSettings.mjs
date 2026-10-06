import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getEkolojikMailConfig, getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';

const DEFAULT_NOTIFICATIONS = {
  contactOpsEmail: true,
  messagingOpsEmail: true,
  billEmailOpsEmail: true,
};

function settingsPath(dataDir) {
  return join(dataDir, 'posta-mail-settings.json');
}

export async function getPostaMailSettings(dataDir) {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(settingsPath(dataDir), 'utf8'));
    return {
      fromName: raw.fromName ?? null,
      replyTo: raw.replyTo ?? null,
      opsEmail: raw.opsEmail ?? null,
      signatureHtml: String(raw.signatureHtml ?? ''),
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(raw.notifications ?? {}) },
      updatedAt: raw.updatedAt ?? null,
    };
  } catch {
    return {
      fromName: null,
      replyTo: null,
      opsEmail: null,
      signatureHtml: '',
      notifications: { ...DEFAULT_NOTIFICATIONS },
      updatedAt: null,
    };
  }
}

export async function savePostaMailSettings(dataDir, patch) {
  const current = await getPostaMailSettings(dataDir);
  const next = {
    fromName: patch.fromName !== undefined ? String(patch.fromName ?? '').trim() || null : current.fromName,
    replyTo: patch.replyTo !== undefined ? String(patch.replyTo ?? '').trim() || null : current.replyTo,
    opsEmail: patch.opsEmail !== undefined ? String(patch.opsEmail ?? '').trim() || null : current.opsEmail,
    signatureHtml: patch.signatureHtml !== undefined ? String(patch.signatureHtml ?? '') : current.signatureHtml,
    notifications: {
      ...current.notifications,
      ...(patch.notifications ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };
  await writeFile(settingsPath(dataDir), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, settings: next };
}

export async function getEffectiveMailPresentation(dataDir) {
  const env = getEkolojikMailConfig();
  const saved = await getPostaMailSettings(dataDir);
  const envOps = getEkolojikOpsEmail();
  return {
    smtpHost: env.smtpHost,
    from: env.from,
    fromName: saved.fromName || env.fromName,
    replyTo: saved.replyTo || env.replyTo || env.from,
    opsEmail: saved.opsEmail?.includes('@') ? saved.opsEmail : envOps,
    signatureHtml: saved.signatureHtml,
    notifications: saved.notifications,
    envFromName: env.fromName,
    envReplyTo: env.replyTo,
    envOpsEmail: envOps,
  };
}

export async function shouldSendPostaNotification(dataDir, kind) {
  const { notifications } = await getPostaMailSettings(dataDir);
  if (kind === 'contact') return notifications.contactOpsEmail !== false;
  if (kind === 'messaging') return notifications.messagingOpsEmail !== false;
  if (kind === 'bill') return notifications.billEmailOpsEmail !== false;
  return true;
}
