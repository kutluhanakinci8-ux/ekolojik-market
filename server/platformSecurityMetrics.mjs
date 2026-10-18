/** Platform — güvenlik özeti, skor, öneriler ve giriş tehdit metrikleri */

const MS_DAY = 24 * 60 * 60 * 1000;

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

function dateKeyTr(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildLoginTrend(loginAuditLog, days = 14, asOfMs = Date.now()) {
  const start = asOfMs - (days - 1) * MS_DAY;
  const buckets = new Map();
  for (let i = 0; i < days; i += 1) {
    const key = dateKeyTr(start + i * MS_DAY);
    buckets.set(key, { dateKey: key, success: 0, failed: 0 });
  }
  for (const entry of loginAuditLog ?? []) {
    const t = parseTime(entry?.createdAt);
    if (t == null || t < start) continue;
    const key = dateKeyTr(t);
    const row = buckets.get(key);
    if (!row) continue;
    if (entry.success === true) row.success += 1;
    else row.failed += 1;
  }
  return [...buckets.values()];
}

export function aggregateFailedByIp(storesByTenant, days = 7, asOfMs = Date.now()) {
  const since = asOfMs - days * MS_DAY;
  const map = new Map();
  for (const { store, tenantId, businessName } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      if (entry?.success !== false) continue;
      const t = parseTime(entry.createdAt);
      if (t == null || t < since) continue;
      const ip = String(entry.clientIp ?? '').trim() || 'bilinmiyor';
      const prev = map.get(ip) ?? {
        clientIp: ip,
        failedCount: 0,
        lastAt: null,
        tenants: new Set(),
        usernames: new Set(),
      };
      prev.failedCount += 1;
      prev.tenants.add(tenantId);
      if (entry.username) prev.usernames.add(entry.username);
      if (prev.lastAt == null || t > parseTime(prev.lastAt)) {
        prev.lastAt = entry.createdAt;
      }
      map.set(ip, prev);
    }
  }
  return [...map.values()]
    .map((row) => ({
      clientIp: row.clientIp,
      failedCount: row.failedCount,
      lastAt: row.lastAt,
      tenantCount: row.tenants.size,
      sampleTenants: [...row.tenants].slice(0, 3).join(', '),
      distinctUsernames: row.usernames.size,
    }))
    .sort((a, b) => b.failedCount - a.failedCount);
}

function countAdminsWithoutTotp(roster) {
  return roster.filter((u) => u.isActive && u.role === 'admin' && !u.totpEnabled).length;
}

function countActiveAdmins(roster) {
  return roster.filter((u) => u.isActive && u.role === 'admin').length;
}

function countAdminsWithTotp(roster) {
  return roster.filter((u) => u.isActive && u.role === 'admin' && u.totpEnabled).length;
}

export function buildSecurityRecommendations(totals, roster, failedByIp, tenantStats) {
  const recs = [];
  const push = (item) => recs.push(item);

  if (totals.missingRecoveryEmailCount > 0) {
    push({
      id: 'missing_recovery_email',
      priority: 'high',
      title: 'Sıfırlama e-postası eksik',
      description:
        'Aktif hesaplarda kurtarma e-postası tanımlı değil; şifre sıfırlama ve hesap kurtarma zayıflar.',
      affectedCount: totals.missingRecoveryEmailCount,
      filter: { engagementFilter: 'all', roleFilter: 'all' },
    });
  }

  const adminsNoTotp = countAdminsWithoutTotp(roster);
  if (adminsNoTotp > 0) {
    push({
      id: 'admin_without_2fa',
      priority: 'high',
      title: 'Yönetici hesaplarında 2FA kapalı',
      description: 'Aktif yönetici hesaplarında TOTP etkin değil; öncelikle yöneticilerde 2FA açılmalı.',
      affectedCount: adminsNoTotp,
      filter: { roleFilter: 'admin', engagementFilter: 'all' },
    });
  }

  const neverLogged = roster.filter((u) => u.isActive && u.engagement === 'never_logged_in').length;
  if (neverLogged > 0) {
    push({
      id: 'never_logged_in',
      priority: 'medium',
      title: 'Hiç giriş yapılmamış aktif hesaplar',
      description: 'Bu hesaplar oluşturuldu ancak başarılı giriş kaydı yok; davet veya devre dışı bırakma değerlendirilmeli.',
      affectedCount: neverLogged,
      filter: { engagementFilter: 'never_logged_in', roleFilter: 'all' },
    });
  }

  if (totals.mustChangePasswordCount > 0) {
    push({
      id: 'must_change_password',
      priority: 'medium',
      title: 'Zorunlu şifre değişimi bekliyor',
      description: 'mustChangePassword işaretli hesaplar ilk girişte şifre güncellemeli.',
      affectedCount: totals.mustChangePasswordCount,
      filter: { engagementFilter: 'all', roleFilter: 'all' },
    });
  }

  const dormantAdmins = roster.filter(
    (u) => u.isActive
      && u.role === 'admin'
      && (u.engagement === 'dormant_30' || u.engagement === 'dormant_60'),
  ).length;
  if (dormantAdmins > 0) {
    push({
      id: 'dormant_admins',
      priority: 'medium',
      title: 'Uzun süredir giriş yapmayan yöneticiler',
      description: '30 gün veya daha uzun süredir giriş yapmayan yönetici hesapları.',
      affectedCount: dormantAdmins,
      filter: { roleFilter: 'admin', engagementFilter: 'dormant_30' },
    });
  }

  const loginTotal = totals.loginSuccess30d + totals.loginFailed30d;
  const failRate = loginTotal ? totals.loginFailed30d / loginTotal : 0;
  if (totals.loginFailed30d >= 10 && failRate >= 0.25) {
    push({
      id: 'elevated_failed_logins',
      priority: 'high',
      title: 'Yüksek başarısız giriş oranı (30g)',
      description: `Son 30 günde ${totals.loginFailed30d} başarısız deneme (${Math.round(failRate * 100)}% oran). Brute-force veya yanlış kimlik bilgisi riski.`,
      affectedCount: totals.loginFailed30d,
      filter: null,
    });
  }

  for (const row of failedByIp) {
    if (row.failedCount < 5) continue;
    push({
      id: `suspicious_ip_${row.clientIp}`,
      priority: row.failedCount >= 10 ? 'high' : 'medium',
      title: `Şüpheli IP: ${row.clientIp}`,
      description: `Son 7 günde ${row.failedCount} başarısız giriş, ${row.distinctUsernames} farklı kullanıcı, ${row.tenantCount} mağaza.`,
      affectedCount: row.failedCount,
      filter: null,
      meta: { clientIp: row.clientIp },
    });
    if (recs.filter((r) => r.id.startsWith('suspicious_ip_')).length >= 5) break;
  }

  for (const t of tenantStats) {
    const tTotal = t.loginSuccess30d + t.loginFailed30d;
    if (t.loginFailed30d >= 8 && tTotal && t.loginFailed30d / tTotal >= 0.35) {
      push({
        id: `tenant_failures_${t.tenantId}`,
        priority: 'medium',
        title: `${t.businessName}: yoğun başarısız giriş`,
        description: `30 günde ${t.loginFailed30d} başarısız deneme.`,
        affectedCount: t.loginFailed30d,
        filter: { tenantFilter: t.tenantId, engagementFilter: 'all', roleFilter: 'all' },
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  return recs;
}

export function computeSecurityScore(totals, roster, recommendations) {
  const activeAdmins = countActiveAdmins(roster);
  const adminMfaPct = activeAdmins
    ? Math.round((countAdminsWithTotp(roster) / activeAdmins) * 100)
    : 100;

  const loginTotal = totals.loginSuccess30d + totals.loginFailed30d;
  const loginSuccessPct = loginTotal
    ? Math.round((totals.loginSuccess30d / loginTotal) * 100)
    : 100;

  const dimensions = {
    recoveryEmailPct: totals.recoveryEmailCoveragePct,
    adminMfaPct,
    loginSuccessPct,
    engagement30dPct: totals.engagementRate30d,
    totpCoveragePct: totals.totpCoveragePct,
  };

  let score = Math.round(
    dimensions.recoveryEmailPct * 0.25
    + dimensions.adminMfaPct * 0.3
    + dimensions.loginSuccessPct * 0.2
    + dimensions.engagement30dPct * 0.15
    + dimensions.totpCoveragePct * 0.1,
  );

  const highOpen = recommendations.filter((r) => r.priority === 'high').length;
  score = Math.max(0, Math.min(100, score - highOpen * 4));

  let grade = 'C';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade, dimensions };
}

export function tenantSecuritySnapshots(tenantAnalytics) {
  return tenantAnalytics.map((t) => {
    const roster = t.roster ?? [];
    const activeAdmins = roster.filter((u) => u.isActive && u.role === 'admin').length;
    const adminsTotp = roster.filter((u) => u.isActive && u.role === 'admin' && u.totpEnabled).length;
    const loginTotal = t.loginSuccess30d + t.loginFailed30d;
    const loginSuccessPct = loginTotal
      ? Math.round((t.loginSuccess30d / loginTotal) * 100)
      : 100;
    const mini = Math.round(
      t.recoveryEmailCoveragePct * 0.35
      + (activeAdmins ? (adminsTotp / activeAdmins) * 100 : 100) * 0.35
      + loginSuccessPct * 0.3,
    );
    return {
      tenantId: t.tenantId,
      businessName: t.businessName,
      securityScore: mini,
      recoveryEmailCoveragePct: t.recoveryEmailCoveragePct,
      totpCoveragePct: t.totpCoveragePct,
      loginFailed30d: t.loginFailed30d,
      loginSuccess30d: t.loginSuccess30d,
      missingRecoveryEmailCount: t.missingRecoveryEmailCount,
      adminCount: t.adminCount,
    };
  }).sort((a, b) => a.securityScore - b.securityScore);
}

export function buildPlatformSecurityOverview({
  userOps,
  loginTrend,
  failedByIp,
  recommendations,
  scorePayload,
  tenantSnapshots,
  activitySummary,
}) {
  const high = recommendations.filter((r) => r.priority === 'high').length;
  const medium = recommendations.filter((r) => r.priority === 'medium').length;
  return {
    generatedAt: new Date().toISOString(),
    score: scorePayload.score,
    grade: scorePayload.grade,
    dimensions: scorePayload.dimensions,
    recommendationSummary: { total: recommendations.length, high, medium },
    recommendations,
    totals: userOps.totals,
    loginTrend,
    failedByIp: failedByIp.slice(0, 12),
    tenantSnapshots,
    recentLogins: (userOps.recentLogins ?? []).slice(0, 40),
    activity: activitySummary,
  };
}
