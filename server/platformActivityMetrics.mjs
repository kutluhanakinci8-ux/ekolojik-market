/** Platform — kiracı activityAuditLog özetleri (güvenlik odaklı) */

const MS_DAY = 24 * 60 * 60 * 1000;

const SECURITY_ACTIONS = new Set([
  'user_create',
  'user_update',
  'user_delete',
  'user_lock',
  'user_unlock',
  'password_change',
  'totp_enable',
  'totp_disable',
  'unlock_login',
  'settings_update',
  'backup_export',
  'backup_import',
  'backup_push',
  'warehouse_reset',
  'login',
  'logout',
]);

const ACTION_LABELS = {
  user_create: 'Kullanıcı oluşturma',
  user_update: 'Kullanıcı güncelleme',
  user_delete: 'Kullanıcı silme',
  user_lock: 'Kullanıcı kilitleme',
  user_unlock: 'Kullanıcı kilidi açma',
  password_change: 'Şifre değişimi',
  totp_enable: '2FA açma',
  totp_disable: '2FA kapama',
  unlock_login: 'Giriş kilidi açma',
  settings_update: 'Ayar değişikliği',
  backup_export: 'Yedek dışa aktarma',
  backup_import: 'Yedek içe aktarma',
  backup_push: 'Yedek sunucuya gönderme',
  warehouse_reset: 'İrsaliye depo sıfırlama',
  login: 'Giriş',
  logout: 'Çıkış',
};

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function collectMergedActivities(storesByTenant, { sinceMs = 0, securityOnly = false, limit = 500 } = {}) {
  const rows = [];
  for (const { store, tenantId, businessName } of storesByTenant) {
    for (const entry of store?.activityAuditLog ?? []) {
      if (!entry?.createdAt) continue;
      const action = String(entry.action ?? '');
      if (securityOnly && !SECURITY_ACTIONS.has(action)) continue;
      const t = parseTime(entry.createdAt);
      if (sinceMs && (t == null || t < sinceMs)) continue;
      rows.push({
        tenantId,
        businessName,
        id: entry.id,
        action,
        actionLabel: ACTION_LABELS[action] ?? action,
        username: entry.username,
        displayName: entry.displayName,
        summary: entry.summary,
        sessionId: entry.sessionId,
        createdAt: entry.createdAt,
      });
    }
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows.slice(0, limit);
}

export function summarizePlatformActivity(storesByTenant, days = 30, asOfMs = Date.now()) {
  const since = asOfMs - days * MS_DAY;
  let events30d = 0;
  const byAction = new Map();
  for (const { store } of storesByTenant) {
    for (const entry of store?.activityAuditLog ?? []) {
      const t = parseTime(entry?.createdAt);
      if (t == null || t < since) continue;
      events30d += 1;
      const action = String(entry.action ?? '');
      if (!SECURITY_ACTIONS.has(action)) continue;
      byAction.set(action, (byAction.get(action) ?? 0) + 1);
    }
  }
  const securityEvents30d = [...byAction.values()].reduce((s, n) => s + n, 0);
  const recentSecurity = collectMergedActivities(storesByTenant, {
    sinceMs: since,
    securityOnly: true,
    limit: 45,
  });
  const topActions = [...byAction.entries()]
    .map(([action, count]) => ({
      action,
      label: ACTION_LABELS[action] ?? action,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byTenant = new Map();
  for (const { tenantId, businessName, store } of storesByTenant) {
    let events30d = 0;
    let security30d = 0;
    for (const entry of store?.activityAuditLog ?? []) {
      const t = parseTime(entry?.createdAt);
      if (t == null || t < since) continue;
      events30d += 1;
      if (SECURITY_ACTIONS.has(String(entry.action ?? ''))) security30d += 1;
    }
    byTenant.set(tenantId, { tenantId, businessName, events30d, securityEvents30d: security30d });
  }

  return {
    events30d,
    securityEvents30d,
    topActions,
    byTenant: [...byTenant.values()].sort((a, b) => b.securityEvents30d - a.securityEvents30d),
    recentSecurity,
  };
}

export function buildPlatformSecurityCsv(storesByTenant, days = 90, asOfMs = Date.now()) {
  const since = asOfMs - days * MS_DAY;
  const header = ['Tur', 'Tarih', 'Mağaza', 'Kullanıcı', 'Olay', 'Detay', 'IP', 'Başarılı'];
  const lines = [header.join(',')];

  for (const { store, tenantId, businessName } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      const t = parseTime(entry?.createdAt);
      if (t == null || t < since) continue;
      lines.push([
        'giris',
        entry.createdAt,
        businessName,
        entry.displayName || entry.username,
        entry.method ?? 'password',
        entry.failureReason ?? (entry.success ? 'OK' : 'Hata'),
        entry.clientIp ?? '',
        entry.success === true ? 'evet' : 'hayır',
      ].map(csvEscape).join(','));
    }
    for (const entry of store?.activityAuditLog ?? []) {
      const t = parseTime(entry?.createdAt);
      if (t == null || t < since) continue;
      if (!SECURITY_ACTIONS.has(String(entry.action ?? ''))) continue;
      lines.push([
        'aktivite',
        entry.createdAt,
        businessName,
        entry.displayName || entry.username,
        ACTION_LABELS[entry.action] ?? entry.action,
        entry.summary ?? '',
        '',
        'evet',
      ].map(csvEscape).join(','));
    }
  }

  return `\ufeff${lines.join('\n')}`;
}
