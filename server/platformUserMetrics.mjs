/** Platform — kiracı POS kullanıcıları ve giriş denetimi özetleri */

const MS_DAY = 24 * 60 * 60 * 1000;

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

function lastSuccessfulLogins(loginAuditLog) {
  const map = new Map();
  for (const entry of loginAuditLog ?? []) {
    if (!entry?.success) continue;
    const key = entry.userId || entry.username;
    if (!key) continue;
    const t = parseTime(entry.createdAt);
    if (t == null) continue;
    const prev = map.get(key);
    if (prev == null || t > prev) map.set(key, t);
  }
  return map;
}

export function analyzeTenantUsers(store, tenantId, businessName, asOfMs = Date.now()) {
  const users = Array.isArray(store?.users) ? store.users : [];
  const loginAuditLog = Array.isArray(store?.loginAuditLog) ? store.loginAuditLog : [];
  const lastLogin = lastSuccessfulLogins(loginAuditLog);
  const d30 = asOfMs - 30 * MS_DAY;
  const d60 = asOfMs - 60 * MS_DAY;
  const d7 = asOfMs - 7 * MS_DAY;

  let activeCount = 0;
  let inactiveCount = 0;
  let adminCount = 0;
  let cashierCount = 0;
  let totpEnabledCount = 0;
  let missingRecoveryEmailCount = 0;
  let mustChangePasswordCount = 0;
  let createdLast30d = 0;
  let dormant30d = 0;
  let dormant60d = 0;
  let loggedInLast7d = 0;
  let loggedInLast30d = 0;

  const roster = [];

  for (const raw of users) {
    const username = String(raw.username ?? '').trim().toLowerCase();
    if (!username || username.startsWith('platform:')) continue;
    const isActive = raw.isActive !== false;
    const role = raw.role === 'admin' ? 'admin' : 'cashier';
    const createdAt = raw.createdAt ?? null;
    const createdMs = parseTime(createdAt);
    const lastMs =
      lastLogin.get(raw.id)
      ?? lastLogin.get(username)
      ?? null;

    if (isActive) activeCount += 1;
    else inactiveCount += 1;
    if (role === 'admin') adminCount += 1;
    else cashierCount += 1;
    if (raw.totpEnabled === true) totpEnabledCount += 1;
    if (isActive && !String(raw.recoveryEmail ?? '').includes('@')) missingRecoveryEmailCount += 1;
    if (raw.mustChangePassword === true) mustChangePasswordCount += 1;
    if (createdMs != null && createdMs >= d30) createdLast30d += 1;

    let engagement = 'active';
    if (!isActive) {
      engagement = 'churned';
    } else if (lastMs == null) {
      engagement = createdMs != null && createdMs >= d30 ? 'new' : 'never_logged_in';
      if (engagement !== 'new') dormant30d += 1;
    } else if (lastMs < d60) {
      engagement = 'dormant_60';
      dormant60d += 1;
      dormant30d += 1;
    } else if (lastMs < d30) {
      engagement = 'dormant_30';
      dormant30d += 1;
    }

    if (isActive && lastMs != null && lastMs >= d7) loggedInLast7d += 1;
    if (isActive && lastMs != null && lastMs >= d30) loggedInLast30d += 1;

    roster.push({
      tenantId,
      businessName,
      id: raw.id,
      username,
      displayName: String(raw.displayName ?? username).trim() || username,
      role,
      isActive,
      engagement,
      totpEnabled: raw.totpEnabled === true,
      hasRecoveryEmail: String(raw.recoveryEmail ?? '').includes('@'),
      mustChangePassword: raw.mustChangePassword === true,
      createdAt,
      lastLoginAt: lastMs != null ? new Date(lastMs).toISOString() : null,
      updatedAt: raw.updatedAt ?? null,
    });
  }

  const totalUsers = roster.length;
  const loginSuccess30d = (loginAuditLog ?? []).filter(
    (e) => e?.success && parseTime(e.createdAt) != null && parseTime(e.createdAt) >= d30,
  ).length;
  const loginFailed30d = (loginAuditLog ?? []).filter(
    (e) => e?.success === false && parseTime(e.createdAt) != null && parseTime(e.createdAt) >= d30,
  ).length;

  return {
    tenantId,
    businessName,
    totalUsers,
    activeCount,
    inactiveCount,
    churnedCount: inactiveCount,
    dormant30dCount: dormant30d,
    dormant60dCount: dormant60d,
    newUsers30d: createdLast30d,
    adminCount,
    cashierCount,
    totpEnabledCount,
    missingRecoveryEmailCount,
    mustChangePasswordCount,
    loggedInLast7d,
    loggedInLast30d,
    loginSuccess30d,
    loginFailed30d,
    totpCoveragePct: totalUsers ? Math.round((totpEnabledCount / totalUsers) * 100) : 0,
    recoveryEmailCoveragePct: activeCount
      ? Math.round(((activeCount - missingRecoveryEmailCount) / activeCount) * 100)
      : 100,
    roster,
  };
}

export function mergeRecentLogins(storesByTenant, limit = 40) {
  const rows = [];
  for (const { store, tenantId, businessName } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      if (!entry?.createdAt) continue;
      rows.push({
        tenantId,
        businessName,
        id: entry.id,
        username: entry.username,
        displayName: entry.displayName,
        success: entry.success === true,
        method: entry.method,
        createdAt: entry.createdAt,
        failureReason: entry.failureReason,
        failureKind: entry.failureKind,
        clientIp: entry.clientIp,
      });
    }
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows.slice(0, limit);
}

export function buildPlatformUserOperations(allTenantAnalytics, recentLogins) {
  const tenants = allTenantAnalytics.map((t) => {
    const { roster, ...summary } = t;
    return summary;
  });

  const roster = allTenantAnalytics.flatMap((t) => t.roster);
  roster.sort((a, b) => {
    const aTime = parseTime(a.lastLoginAt) ?? 0;
    const bTime = parseTime(b.lastLoginAt) ?? 0;
    return bTime - aTime;
  });

  const totals = tenants.reduce(
    (acc, t) => ({
      totalUsers: acc.totalUsers + t.totalUsers,
      activeCount: acc.activeCount + t.activeCount,
      inactiveCount: acc.inactiveCount + t.inactiveCount,
      churnedCount: acc.churnedCount + t.churnedCount,
      dormant30dCount: acc.dormant30dCount + t.dormant30dCount,
      dormant60dCount: acc.dormant60dCount + t.dormant60dCount,
      newUsers30d: acc.newUsers30d + t.newUsers30d,
      adminCount: acc.adminCount + t.adminCount,
      cashierCount: acc.cashierCount + t.cashierCount,
      totpEnabledCount: acc.totpEnabledCount + t.totpEnabledCount,
      missingRecoveryEmailCount: acc.missingRecoveryEmailCount + t.missingRecoveryEmailCount,
      mustChangePasswordCount: acc.mustChangePasswordCount + t.mustChangePasswordCount,
      loggedInLast7d: acc.loggedInLast7d + t.loggedInLast7d,
      loggedInLast30d: acc.loggedInLast30d + t.loggedInLast30d,
      loginSuccess30d: acc.loginSuccess30d + t.loginSuccess30d,
      loginFailed30d: acc.loginFailed30d + t.loginFailed30d,
    }),
    {
      totalUsers: 0,
      activeCount: 0,
      inactiveCount: 0,
      churnedCount: 0,
      dormant30dCount: 0,
      dormant60dCount: 0,
      newUsers30d: 0,
      adminCount: 0,
      cashierCount: 0,
      totpEnabledCount: 0,
      missingRecoveryEmailCount: 0,
      mustChangePasswordCount: 0,
      loggedInLast7d: 0,
      loggedInLast30d: 0,
      loginSuccess30d: 0,
      loginFailed30d: 0,
    },
  );

  totals.totpCoveragePct = totals.totalUsers
    ? Math.round((totals.totpEnabledCount / totals.totalUsers) * 100)
    : 0;
  totals.recoveryEmailCoveragePct = totals.activeCount
    ? Math.round(
      ((totals.activeCount - totals.missingRecoveryEmailCount) / totals.activeCount) * 100,
    )
    : 100;
  totals.engagementRate30d = totals.activeCount
    ? Math.round((totals.loggedInLast30d / totals.activeCount) * 100)
    : 0;

  const engagementBreakdown = {
    active: roster.filter((u) => u.isActive && u.engagement === 'active').length,
    new: roster.filter((u) => u.engagement === 'new').length,
    dormant_30: roster.filter((u) => u.engagement === 'dormant_30').length,
    dormant_60: roster.filter((u) => u.engagement === 'dormant_60').length,
    never_logged_in: roster.filter((u) => u.engagement === 'never_logged_in').length,
    churned: roster.filter((u) => u.engagement === 'churned').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    totals,
    engagementBreakdown,
    tenants,
    roster,
    recentLogins,
  };
}
