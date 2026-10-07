/** NB PM-8 — olay × kanal bildirim matrisi (POS uyarlaması) */

export const POSTA_NOTIFICATION_CHANNELS = [
  { id: 'opsEmail', label: 'Operasyon e-posta' },
  { id: 'inAppHub', label: 'Posta hub (uyarı kaydı)' },
  { id: 'customerAutoreply', label: 'Müşteri otomatik yanıt', eventIds: ['contact'] },
];

export const POSTA_NOTIFICATION_EVENTS = [
  { id: 'contact', label: 'İletişim formu', legacyKey: 'contactOpsEmail' },
  { id: 'messaging', label: 'Müşteri mesajları', legacyKey: 'messagingOpsEmail' },
  { id: 'bill', label: 'Fatura / gelen e-posta', legacyKey: 'billEmailOpsEmail' },
  { id: 'outbox_failed', label: 'Outbox gönderim hatası' },
];

function defaultCell(eventId, channelId) {
  if (channelId === 'customerAutoreply') return false;
  if (channelId === 'inAppHub') return eventId === 'messaging';
  return true;
}

export function buildDefaultNotificationMatrix() {
  const matrix = {};
  for (const ev of POSTA_NOTIFICATION_EVENTS) {
    matrix[ev.id] = {};
    for (const ch of POSTA_NOTIFICATION_CHANNELS) {
      if (ch.eventIds && !ch.eventIds.includes(ev.id)) {
        matrix[ev.id][ch.id] = false;
      } else {
        matrix[ev.id][ch.id] = defaultCell(ev.id, ch.id);
      }
    }
  }
  return matrix;
}

export function matrixFromLegacyNotifications(notifications = {}) {
  const matrix = buildDefaultNotificationMatrix();
  for (const ev of POSTA_NOTIFICATION_EVENTS) {
    if (ev.legacyKey && notifications[ev.legacyKey] === false) {
      matrix[ev.id].opsEmail = false;
    }
  }
  return matrix;
}

export function legacyNotificationsFromMatrix(matrix) {
  const legacy = {
    contactOpsEmail: matrix.contact?.opsEmail !== false,
    messagingOpsEmail: matrix.messaging?.opsEmail !== false,
    billEmailOpsEmail: matrix.bill?.opsEmail !== false,
  };
  return legacy;
}

function normalizeBool(v, fallback) {
  if (v === true || v === false) return v;
  return fallback;
}

export function normalizeNotificationMatrix(raw) {
  const base = buildDefaultNotificationMatrix();
  if (!raw || typeof raw !== 'object') return base;
  for (const ev of POSTA_NOTIFICATION_EVENTS) {
    const row = raw[ev.id];
    if (!row || typeof row !== 'object') continue;
    for (const ch of POSTA_NOTIFICATION_CHANNELS) {
      if (ch.eventIds && !ch.eventIds.includes(ev.id)) continue;
      base[ev.id][ch.id] = normalizeBool(row[ch.id], base[ev.id][ch.id]);
    }
  }
  return base;
}

export function getPostaNotificationMatrixCatalog() {
  return {
    events: POSTA_NOTIFICATION_EVENTS.map(({ id, label }) => ({ id, label })),
    channels: POSTA_NOTIFICATION_CHANNELS.map(({ id, label, eventIds }) => ({
      id,
      label,
      eventIds: eventIds ?? null,
    })),
  };
}

export function isChannelAllowedForEvent(eventId, channelId) {
  const ch = POSTA_NOTIFICATION_CHANNELS.find((c) => c.id === channelId);
  if (!ch) return false;
  if (ch.eventIds && !ch.eventIds.includes(eventId)) return false;
  return POSTA_NOTIFICATION_EVENTS.some((e) => e.id === eventId);
}

export function matrixChannelEnabled(matrix, eventId, channelId) {
  if (!isChannelAllowedForEvent(eventId, channelId)) return false;
  const row = matrix?.[eventId];
  if (!row) return channelId === 'opsEmail';
  return row[channelId] !== false;
}
