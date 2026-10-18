import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getEkolojikMailConfig, getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import { getTenantSmtpMailConfig } from './tenantMailConfig.mjs';
import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';
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

function normalizeSavedSettings(raw) {
  const notifications = { ...DEFAULT_NOTIFICATIONS, ...(raw.notifications ?? {}) };
  const notificationMatrix = raw.notificationMatrix
    ? normalizeNotificationMatrix(raw.notificationMatrix)
    : matrixFromLegacyNotifications(notifications);
  return {
    fromName: raw.fromName ?? null,
    replyTo: raw.replyTo ?? null,
    opsEmail: raw.opsEmail ?? null,
    signatureHtml: String(raw.signatureHtml ?? ''),
    customerTrackingNoticeEnabled: raw.customerTrackingNoticeEnabled !== false,
    customerTrackingNoticeText: String(raw.customerTrackingNoticeText ?? ''),
    notifications: legacyNotificationsFromMatrix(notificationMatrix),
    notificationMatrix,
    updatedAt: raw.updatedAt ?? null,
  };
}

function defaultGlobalSettings() {
  const notificationMatrix = matrixFromLegacyNotifications(DEFAULT_NOTIFICATIONS);
  return {
    fromName: null,
    replyTo: null,
    opsEmail: null,
    signatureHtml: '',
    customerTrackingNoticeEnabled: true,
    customerTrackingNoticeText: '',
    notifications: { ...DEFAULT_NOTIFICATIONS },
    notificationMatrix,
    updatedAt: null,
  };
}

function mergeTenantPostaMail(globalSettings, tenantRaw) {
  if (!tenantRaw || typeof tenantRaw !== 'object') return globalSettings;
  let notificationMatrix = globalSettings.notificationMatrix;
  if (tenantRaw.notificationMatrix !== undefined) {
    notificationMatrix = normalizeNotificationMatrix(tenantRaw.notificationMatrix);
  } else if (tenantRaw.notifications !== undefined) {
    notificationMatrix = matrixFromLegacyNotifications({
      ...globalSettings.notifications,
      ...tenantRaw.notifications,
    });
  }
  const notifications = legacyNotificationsFromMatrix(notificationMatrix);
  return {
    fromName:
      tenantRaw.fromName !== undefined && tenantRaw.fromName !== null
        ? String(tenantRaw.fromName).trim() || null
        : globalSettings.fromName,
    replyTo:
      tenantRaw.replyTo !== undefined && tenantRaw.replyTo !== null
        ? String(tenantRaw.replyTo).trim() || null
        : globalSettings.replyTo,
    opsEmail:
      tenantRaw.opsEmail !== undefined && tenantRaw.opsEmail !== null
        ? String(tenantRaw.opsEmail).trim() || null
        : globalSettings.opsEmail,
    signatureHtml:
      tenantRaw.signatureHtml !== undefined ? String(tenantRaw.signatureHtml ?? '') : globalSettings.signatureHtml,
    customerTrackingNoticeEnabled:
      tenantRaw.customerTrackingNoticeEnabled !== undefined
        ? Boolean(tenantRaw.customerTrackingNoticeEnabled)
        : globalSettings.customerTrackingNoticeEnabled,
    customerTrackingNoticeText:
      tenantRaw.customerTrackingNoticeText !== undefined
        ? String(tenantRaw.customerTrackingNoticeText ?? '')
        : globalSettings.customerTrackingNoticeText,
    notifications,
    notificationMatrix,
    updatedAt: tenantRaw.updatedAt ?? globalSettings.updatedAt,
  };
}

async function loadGlobalPostaMailSettings(dataDir) {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(settingsPath(dataDir), 'utf8'));
    return normalizeSavedSettings(raw);
  } catch {
    return defaultGlobalSettings();
  }
}

export async function getPostaMailSettings(dataDir, tenantId = 'main') {
  const global = await loadGlobalPostaMailSettings(dataDir);
  const tid = String(tenantId || 'main').trim() || 'main';
  if (tid === 'main') return global;
  const store = await readTenantStore(dataDir, tid);
  return mergeTenantPostaMail(global, store?.settings?.postaMail);
}

function applyPostaMailPatch(current, patch) {
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
  return {
    fromName: patch.fromName !== undefined ? String(patch.fromName ?? '').trim() || null : current.fromName,
    replyTo: patch.replyTo !== undefined ? String(patch.replyTo ?? '').trim() || null : current.replyTo,
    opsEmail: patch.opsEmail !== undefined ? String(patch.opsEmail ?? '').trim() || null : current.opsEmail,
    signatureHtml: patch.signatureHtml !== undefined ? String(patch.signatureHtml ?? '') : current.signatureHtml,
    customerTrackingNoticeEnabled:
      patch.customerTrackingNoticeEnabled !== undefined
        ? Boolean(patch.customerTrackingNoticeEnabled)
        : current.customerTrackingNoticeEnabled,
    customerTrackingNoticeText:
      patch.customerTrackingNoticeText !== undefined
        ? String(patch.customerTrackingNoticeText ?? '')
        : current.customerTrackingNoticeText,
    notifications,
    notificationMatrix,
    updatedAt: new Date().toISOString(),
  };
}

export async function savePostaMailSettings(dataDir, patch, tenantId = 'main') {
  const tid = String(tenantId || 'main').trim() || 'main';
  const current = await getPostaMailSettings(dataDir, tid);
  const next = applyPostaMailPatch(current, patch);

  if (tid === 'main') {
    await writeFile(settingsPath(dataDir), JSON.stringify(next, null, 2), 'utf8');
    return { ok: true, settings: next };
  }

  const store = await readTenantStore(dataDir, tid);
  if (!store) return { ok: false, error: 'Mağaza bulunamadı' };
  store.settings = store.settings ?? {};
  store.settings.postaMail = next;
  store.updatedAt = new Date().toISOString();
  await writeTenantStore(dataDir, tid, store);
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

export async function getEffectiveMailPresentation(dataDir, tenantId = 'main') {
  const env = getEkolojikMailConfig();
  const tenantMail = await getTenantSmtpMailConfig(dataDir, tenantId);
  const saved = await getPostaMailSettings(dataDir, tenantId);
  const envOps = getEkolojikOpsEmail();
  const from = tenantMail.from?.includes('@') ? tenantMail.from : env.from;
  return {
    smtpHost: tenantMail.smtpHost || env.smtpHost,
    from,
    fromName: saved.fromName || tenantMail.fromName || env.fromName,
    replyTo: saved.replyTo || tenantMail.replyTo || env.replyTo || from || env.from,
    opsEmail: saved.opsEmail?.includes('@') ? saved.opsEmail : envOps,
    signatureHtml: saved.signatureHtml,
    notifications: saved.notifications,
    notificationMatrix: saved.notificationMatrix,
    envFromName: env.fromName,
    envReplyTo: env.replyTo,
    envOpsEmail: envOps,
    tenantId,
  };
}

export async function shouldSendPostaNotification(dataDir, event, channel = 'opsEmail', tenantId = 'main') {
  const { notificationMatrix } = await getPostaMailSettings(dataDir, tenantId);
  return matrixChannelEnabled(notificationMatrix, event, channel);
}
