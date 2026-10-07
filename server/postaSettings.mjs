import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getEkolojikMailConfig, getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import {
  getPostaNotificationMatrixCatalog,
  legacyNotificationsFromMatrix,
  matrixChannelEnabled,
  matrixFromLegacyNotifications,
  normalizeNotificationMatrix,
} from './postaNotificationMatrix.mjs';

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
    const notifications = { ...DEFAULT_NOTIFICATIONS, ...(raw.notifications ?? {}) };
    const notificationMatrix = raw.notificationMatrix
      ? normalizeNotificationMatrix(raw.notificationMatrix)
      : matrixFromLegacyNotifications(notifications);
    return {
      fromName: raw.fromName ?? null,
      replyTo: raw.replyTo ?? null,
      opsEmail: raw.opsEmail ?? null,
      signatureHtml: String(raw.signatureHtml ?? ''),
      notifications: legacyNotificationsFromMatrix(notificationMatrix),
      notificationMatrix,
      updatedAt: raw.updatedAt ?? null,
    };
  } catch {
    const notificationMatrix = matrixFromLegacyNotifications(DEFAULT_NOTIFICATIONS);
    return {
      fromName: null,
      replyTo: null,
      opsEmail: null,
      signatureHtml: '',
      notifications: { ...DEFAULT_NOTIFICATIONS },
      notificationMatrix,
      updatedAt: null,
    };
  }
}

export async function savePostaMailSettings(dataDir, patch) {
  const current = await getPostaMailSettings(dataDir);
  let notificationMatrix = current.notificationMatrix;
  if (patch.notificationMatrix !== undefined) {
    notificationMatrix = normalizeNotificationMatrix(patch.notificationMatrix);
  } else if (patch.notifications !== undefined) {
    notificationMatrix = matrixFromLegacyNotifications({
      ...current.notifications,
      ...patch.notifications,
    });
  }
  const notifications = legacyNotificationsFromMatrix(notificationMatrix);
  const next = {
    fromName: patch.fromName !== undefined ? String(patch.fromName ?? '').trim() || null : current.fromName,
    replyTo: patch.replyTo !== undefined ? String(patch.replyTo ?? '').trim() || null : current.replyTo,
    opsEmail: patch.opsEmail !== undefined ? String(patch.opsEmail ?? '').trim() || null : current.opsEmail,
    signatureHtml: patch.signatureHtml !== undefined ? String(patch.signatureHtml ?? '') : current.signatureHtml,
    notifications,
    notificationMatrix,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(settingsPath(dataDir), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, settings: next };
}

export function getPostaNotificationsMatrixHub(settings) {
  const catalog = getPostaNotificationMatrixCatalog();
  return {
    ok: true,
    catalog,
    matrix: settings?.notificationMatrix ?? matrixFromLegacyNotifications(settings?.notifications),
  };
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
    notificationMatrix: saved.notificationMatrix,
    envFromName: env.fromName,
    envReplyTo: env.replyTo,
    envOpsEmail: envOps,
  };
}

export async function shouldSendPostaNotification(dataDir, event, channel = 'opsEmail') {
  const { notificationMatrix } = await getPostaMailSettings(dataDir);
  return matrixChannelEnabled(notificationMatrix, event, channel);
}
