import { posApiAuthHeaders } from './posApiAuth';

export type PlatformDebtorRow = {
  customerId: string;
  name: string;
  balanceTry: number;
};

export type PlatformTenantSummary = {
  tenantId: string;
  label: string;
  businessName: string;
  productProfile: string;
  productCount: number;
  lowStockCount: number;
  saleCount: number;
  recentSaleCount30d: number;
  revenue30dTry: number;
  activeUserCount: number;
  registrationEmail: string | null;
  plan: string | null;
  trialEndsAt: string | null;
  updatedAt: string | null;
  receivablesTotalTry: number;
  debtorsCount: number;
  collections30dTry: number;
  pendingPaymentCount: number;
  pendingPaymentAmountTry: number;
  overduePaymentCount: number;
  overduePaymentAmountTry: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
};

export type PlatformTenantUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  hasRecoveryEmail: boolean;
  totpEnabled: boolean;
  updatedAt?: string;
};

export type PlatformPaymentRow = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  category?: string;
  scope?: string;
  status: string;
};

export type PlatformAlertRow = {
  severity: 'critical' | 'warning' | 'info';
  kind: string;
  tenantId: string;
  businessName: string;
  message: string;
  count?: number;
  amountTry?: number;
};

export type PlatformCalendarDay = {
  dateKey: string;
  items: Array<PlatformPaymentRow & { tenantId: string; businessName: string }>;
  pendingCount: number;
  pendingAmountTry: number;
};

export async function fetchPlatformTenants(): Promise<{
  ok: boolean;
  tenants?: PlatformTenantSummary[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/tenants', {
      headers: posApiAuthHeaders(),
    });
    const data = (await res.json()) as { ok?: boolean; tenants?: PlatformTenantSummary[]; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Kiracı listesi alınamadı' };
    }
    return { ok: true, tenants: data.tenants ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformAlerts(): Promise<{
  ok: boolean;
  alerts?: PlatformAlertRow[];
  summary?: { critical: number; warning: number; info: number };
  asOf?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/alerts', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      alerts?: PlatformAlertRow[];
      summary?: { critical: number; warning: number; info: number };
      asOf?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Uyarılar alınamadı' };
    }
    return {
      ok: true,
      alerts: data.alerts ?? [],
      summary: data.summary,
      asOf: data.asOf,
    };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformCalendar(year: number, month: number): Promise<{
  ok: boolean;
  days?: PlatformCalendarDay[];
  itemCount?: number;
  error?: string;
}> {
  try {
    const res = await fetch(
      `/api/platform/calendar?year=${year}&month=${month}`,
      { headers: posApiAuthHeaders() },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      calendar?: { days: PlatformCalendarDay[]; itemCount: number };
      error?: string;
    };
    if (!res.ok || !data.ok || !data.calendar) {
      return { ok: false, error: data.error ?? 'Takvim alınamadı' };
    }
    return { ok: true, days: data.calendar.days, itemCount: data.calendar.itemCount };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformUserTotals = {
  totalUsers: number;
  activeCount: number;
  inactiveCount: number;
  churnedCount: number;
  dormant30dCount: number;
  dormant60dCount: number;
  newUsers30d: number;
  adminCount: number;
  cashierCount: number;
  totpEnabledCount: number;
  missingRecoveryEmailCount: number;
  mustChangePasswordCount: number;
  loggedInLast7d: number;
  loggedInLast30d: number;
  loginSuccess30d: number;
  loginFailed30d: number;
  totpCoveragePct: number;
  recoveryEmailCoveragePct: number;
  engagementRate30d: number;
};

export type PlatformTenantUserStats = PlatformUserTotals & {
  tenantId: string;
  businessName: string;
};

export type PlatformUserRosterRow = {
  tenantId: string;
  businessName: string;
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'cashier';
  isActive: boolean;
  engagement: string;
  totpEnabled: boolean;
  hasRecoveryEmail: boolean;
  mustChangePassword: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  updatedAt: string | null;
};

export type PlatformRecentLoginRow = {
  tenantId: string;
  businessName: string;
  id: string;
  username: string;
  displayName?: string;
  success: boolean;
  method?: string;
  createdAt: string;
  failureReason?: string;
  clientIp?: string;
};

export type PlatformUserOperationsPayload = {
  generatedAt: string;
  totals: PlatformUserTotals;
  engagementBreakdown: Record<string, number>;
  tenants: PlatformTenantUserStats[];
  roster: PlatformUserRosterRow[];
  recentLogins: PlatformRecentLoginRow[];
};

export type PlatformSecurityRecommendation = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCount: number;
  filter: {
    tenantFilter?: string;
    engagementFilter?: string;
    roleFilter?: 'all' | 'admin' | 'cashier';
  } | null;
  meta?: { clientIp?: string };
};

export type PlatformSecurityPayload = {
  generatedAt: string;
  score: number;
  grade: string;
  dimensions: {
    recoveryEmailPct: number;
    adminMfaPct: number;
    loginSuccessPct: number;
    engagement30dPct: number;
    totpCoveragePct: number;
  };
  recommendationSummary: { total: number; high: number; medium: number };
  recommendations: PlatformSecurityRecommendation[];
  totals: PlatformUserTotals;
  loginTrend: Array<{ dateKey: string; success: number; failed: number }>;
  failedByIp: Array<{
    clientIp: string;
    failedCount: number;
    lastAt: string | null;
    tenantCount: number;
    sampleTenants: string;
    distinctUsernames: number;
  }>;
  tenantSnapshots: Array<{
    tenantId: string;
    businessName: string;
    securityScore: number;
    recoveryEmailCoveragePct: number;
    totpCoveragePct: number;
    loginFailed30d: number;
    loginSuccess30d: number;
    missingRecoveryEmailCount: number;
    adminCount: number;
  }>;
  recentLogins: PlatformRecentLoginRow[];
  activity: {
    events30d: number;
    securityEvents30d: number;
    topActions: Array<{ action: string; label: string; count: number }>;
    byTenant: Array<{
      tenantId: string;
      businessName: string;
      events30d: number;
      securityEvents30d: number;
    }>;
    recentSecurity: Array<{
      tenantId: string;
      businessName: string;
      id: string;
      action: string;
      actionLabel: string;
      username: string;
      displayName: string;
      summary: string;
      sessionId?: string;
      createdAt: string;
    }>;
  };
  failedLogins24h?: number;
  thresholdAlerts?: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
    metric: number;
    threshold: number;
  }>;
  alertPolicy?: PlatformSecurityAlertPolicy;
  platformSessionEpoch?: number;
  revokeCandidates?: Array<{
    tenantId: string;
    userId: string;
    username: string;
    displayName: string;
    businessName: string;
    role: string;
  }>;
};

export type PlatformSecurityAlertPolicy = {
  enabled: boolean;
  emailOps: boolean;
  webhookUrl: string;
  cooldownMinutes: number;
  thresholds: {
    failedLogins24h: number;
    securityScoreBelow: number;
    highRecommendations: number;
  };
  lastFired?: Record<string, string>;
};

export type PlatformTenantLifecycleRow = {
  tenantId: string;
  businessName: string;
  label: string;
  status: 'active' | 'trial' | 'trial_expired' | 'suspended' | 'missing_store';
  statusReason: string;
  statusLabel: string;
  plan: string | null;
  productProfile: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  registrationEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  activeUserCount: number;
  revenue30dTry: number;
  onAllowlist: boolean;
  suspended: boolean;
  readOnly: boolean;
  opsNotes: string;
  postaOnboardingStatus: string | null;
};

export type PlatformTenantLifecyclePayload = {
  generatedAt: string;
  config: {
    strictAllowlist: boolean;
    allowlist: string[];
    publicRegistrationEnabled: boolean;
  };
  totals: {
    tenants: number;
    active: number;
    trial: number;
    trial_expired: number;
    suspended: number;
    missing_store: number;
    readOnly: number;
    allowlisted: number;
    trialEnding7d: number;
  };
  tenants: PlatformTenantLifecycleRow[];
};

export type PlatformCommsTenantRow = {
  tenantId: string;
  businessName: string;
  outbox: { pending: number; sent: number; failed: number };
  messaging: {
    threadsTracked: number;
    firstResponseRecorded: number;
    pendingFirstResponse: number;
    open: number;
    waiting: number;
    closed: number;
  };
  firstResponse: {
    avgMs: number | null;
    medianMs: number | null;
    p90Ms: number | null;
    samples: number;
  };
  engagement: { opens: number; clicks: number; bounces: number };
};

export type PlatformCommsPayload = {
  generatedAt: string;
  windowDays: number;
  outboxCounts: { pending: number; sent: number; failed: number };
  outboxWindow: {
    sent: number;
    failed: number;
    attempted: number;
    successRatePercent: number | null;
  };
  outboxByDay: Array<{ date: string; sent: number; failed: number }>;
  failureBreakdown: Array<{ id: string; label: string; count: number; sample: string | null }>;
  recentErrors: Array<{
    id: string;
    to: string;
    subject: string;
    at: string;
    error: string;
    errorClass: string;
  }>;
  pendingSample: number;
  recentOutbox: Array<{
    id: string;
    tenantId: string;
    folder: string;
    to: string;
    subject: string;
    at: string;
    lastError: string | null;
  }>;
  engagement: {
    windowDays: number;
    mailTrackEnabled: boolean;
    clickTrackEnabled: boolean;
    webhookConfigured: boolean;
    totals: {
      opens: number;
      uniqueOpens: number;
      clicks: number;
      uniqueClicks: number;
      bounces: number;
    };
    byTenant: Array<{ tenantId: string; opens: number; clicks: number; bounces: number }>;
  };
  messagingTotals: {
    open: number;
    waiting: number;
    closed: number;
    pendingFirstResponse: number;
  };
  tenants: PlatformCommsTenantRow[];
  capabilities: {
    smtpConfigured: boolean;
    mailTrackEnabled: boolean;
    failedAlertThreshold: number;
  };
};

async function platformSecurityPost<T>(path: string, body?: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : '{}',
    });
    const data = (await res.json()) as T & { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'İşlem başarısız' };
    }
    if (data.ok === false) {
      return { ok: false, error: data.error ?? 'İşlem başarısız' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformSecurityPolicy(
  policy: Partial<PlatformSecurityAlertPolicy>,
): Promise<{ ok: boolean; policy?: PlatformSecurityAlertPolicy; error?: string }> {
  try {
    const res = await fetch('/api/platform/security/policy', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    const data = (await res.json()) as { ok?: boolean; policy?: PlatformSecurityAlertPolicy; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Politika kaydedilemedi' };
    }
    return { ok: true, policy: data.policy };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function runPlatformSecurityNotifyCheck(force = false): Promise<{
  ok: boolean;
  sent?: boolean;
  message?: string;
  error?: string;
}> {
  const result = await platformSecurityPost<{ sent?: boolean; message?: string }>(
    '/api/platform/security/notify-check',
    { force },
  );
  if (!result.ok) return result;
  return { ok: true, sent: result.data?.sent, message: result.data?.message };
}

export async function revokePlatformOperatorSessions(): Promise<{ ok: boolean; error?: string }> {
  const result = await platformSecurityPost('/api/platform/security/revoke-platform-sessions');
  return { ok: result.ok, error: result.error };
}

export async function revokeTenantUserPlatformSession(
  tenantId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await platformSecurityPost('/api/platform/security/revoke-user', { tenantId, userId });
  return { ok: result.ok, error: result.error };
}

export async function downloadPlatformSecurityCsv(days = 90): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/platform/security/export.csv?days=${days}`, {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-guvenlik-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformSecurityOverview(): Promise<{
  ok: boolean;
  data?: PlatformSecurityPayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/security', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSecurityPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Güvenlik özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformSecurityPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformAuditTimelineEvent = {
  kind: 'login' | 'activity';
  tenantId: string;
  businessName: string;
  createdAt: string;
  success?: boolean;
  username?: string;
  displayName?: string;
  clientIp?: string | null;
  title: string;
  detail: string;
  action?: string;
};

export type PlatformAuditPayload = {
  generatedAt: string;
  windowDays: number;
  securityScore: number;
  totals: {
    activityEvents: number;
    securityActivityEvents: number;
    loginSuccess: number;
    loginFailed: number;
    failedLogins24h: number;
  };
  activity: PlatformSecurityPayload['activity'];
  timeline: PlatformAuditTimelineEvent[];
  recentFailedLogins: PlatformAuditTimelineEvent[];
  notify: {
    policyEnabled: boolean;
    emailOps: boolean;
    webhookConfigured: boolean;
    thresholds: PlatformSecurityAlertPolicy['thresholds'];
    cooldownMinutes: number;
    history: Array<{ alertId: string; label: string; lastFiredAt: string }>;
    activeThresholds: Array<{
      id: string;
      severity: string;
      title: string;
      detail: string;
      metric: number;
      threshold: number;
    }>;
  };
};

export type PlatformBillingTenantRow = {
  tenantId: string;
  businessName: string;
  plan: string;
  lifecycleStatus: string;
  revenueWindowTry: number;
  revenue7dTry: number;
  salesWindow: number;
  receivablesTotalTry: number;
  collections30dTry: number;
  collectionRatePercent: number | null;
  pendingPaymentAmountTry: number;
  overduePaymentAmountTry: number;
  estimatedMrrTry: number;
};

export type PlatformBillingPayload = {
  generatedAt: string;
  windowDays: number;
  planPricingNote: string;
  totals: {
    revenueWindowTry: number;
    revenue7dTry: number;
    salesWindow: number;
    receivablesTotalTry: number;
    collections30dTry: number;
    portfolioCollectionRatePercent: number | null;
    debtorsCount: number;
    pendingPaymentAmountTry: number;
    overduePaymentAmountTry: number;
    overduePaymentCount: number;
    estimatedMrrTry: number;
    estimatedArrTry: number;
    billableTenants: number;
    tenantCount: number;
  };
  planMix: Array<{ plan: string; count: number; mrrPerTenantTry: number; mrrTotalTry: number }>;
  revenueByDay: Array<{ date: string; revenueTry: number }>;
  topDebtors: Array<{
    tenantId: string;
    businessName: string;
    customerId: string;
    name: string;
    balanceTry: number;
  }>;
  tenants: PlatformBillingTenantRow[];
};

export type ClosedCaseInboundMode = 'reopen' | 'keep_closed' | 'new_case';

export type PlatformSupportSlaPolicy = {
  firstResponseTargetMinutes: number;
  staleWaitingHours: number;
  closedCaseInbound?: ClosedCaseInboundMode;
  windowDaysDefault?: number;
  updatedAt?: string;
};

export type PlatformSupportQueueItem = {
  id: string;
  tenantId: string;
  businessName: string;
  threadId: string;
  kind: 'first_response' | 'stale_waiting';
  severity: string;
  status: string;
  subject: string;
  customerName: string;
  waitMs: number;
  targetMs: number;
  updatedAt: string;
  assignedUserId: string | null;
  channel: string;
};

export type PlatformSupportTenantRow = {
  tenantId: string;
  businessName: string;
  messaging: PlatformCommsTenantRow['messaging'];
  firstResponse: PlatformCommsTenantRow['firstResponse'];
  onboardingStatus: string;
  messagingEmbedReady: boolean;
  postaOnboardingComplete: boolean;
  queueItems: number;
  slaBreaches: number;
};

export type PlatformSupportPayload = {
  generatedAt: string;
  windowDays: number;
  policy: Pick<PlatformSupportSlaPolicy, 'firstResponseTargetMinutes' | 'staleWaitingHours' | 'closedCaseInbound'>;
  capabilities: {
    messagingPublicConfigured: boolean;
    supportMailboxConfigured?: boolean;
    supportMailboxAddress?: string | null;
  };
  cases?: {
    total: number;
    open: number;
    new: number;
    request: number;
    incident: number;
    overdue: number;
  };
  contactForm?: {
    total: number;
    withoutCase: number;
  };
  opsSignals?: {
    outboxFailed: number;
    outboxPending: number;
    platformAlertsCritical: number;
    platformAlertsWarning: number;
  };
  inbox?: {
    unread: number;
    total: number;
    lastSyncAt: string | null;
    recent: Array<{
      id: string;
      from: string;
      subject: string;
      receivedAt: string;
      readAt: string | null;
      autoreplySentAt: string | null;
    }>;
  };
  totals: {
    openThreads: number;
    waitingThreads: number;
    pendingFirstResponse: number;
    queueSize: number;
    slaBreaches: number;
    slaMet: number;
    compliancePercent: number | null;
    firstResponse: {
      avgMs: number | null;
      medianMs: number | null;
      p90Ms: number | null;
      samples: number;
    };
  };
  queue: PlatformSupportQueueItem[];
  tenants: PlatformSupportTenantRow[];
};

export type PlatformConsoleSettings = {
  maintenanceBanner: { enabled: boolean; message: string };
  operatorNotes: string;
  defaultTrialDays: number;
  planMrrTryOverrides: Record<string, number | string>;
  updatedAt?: string;
};

export type PlatformSettingsPayload = {
  generatedAt: string;
  runtime: {
    nodeEnv: string;
    strictTenantAllowlist: boolean;
    publicRegistrationEnabled: boolean;
    allowlist: string[];
    allowlistSource: string;
    registrationCount: number;
    platformSessionEpoch: number;
  };
  integrations: {
    mailTrackEnabled: boolean;
    clickTrackEnabled: boolean;
    engagementWebhookConfigured: boolean;
    messagingPublicApiConfigured: boolean;
    smtpHost: string | null;
    publicRegisterEnv: string | null;
    tenantStrictEnv: string | null;
  };
  operators: Array<{
    username: string;
    displayName: string;
    recoveryEmailMasked: string | null;
    updatedAt: string | null;
  }>;
  policies: {
    securityAlerts: {
      enabled: boolean;
      emailOps: boolean;
      webhookConfigured: boolean;
      cooldownMinutes: number;
      thresholds: PlatformSecurityAlertPolicy['thresholds'];
    };
    supportSla: {
      firstResponseTargetMinutes: number;
      staleWaitingHours: number;
    };
  };
  console: PlatformConsoleSettings;
  planMrrCatalog: Array<{
    plan: string;
    defaultMrrTry: number;
    effectiveMrrTry: number;
    overridden: boolean;
  }>;
};

export type PlatformIntegrationConnector = {
  id: string;
  category: string;
  label: string;
  priority: string;
  status: 'ok' | 'warn' | 'off' | string;
  detail: string;
};

export type PlatformIntegrationsPayload = {
  generatedAt: string;
  score: number;
  connectors: PlatformIntegrationConnector[];
  webhooks: Array<{
    id: string;
    label: string;
    configured: boolean;
    enabled: boolean;
    urlMasked: string | null;
    source: string;
  }>;
  realtime: {
    path: string;
    connectedClients: number;
    lastBroadcastAt: string | null;
    broadcastCount: number;
  };
  outbox: { pending: number; failed: number; sent: number };
  tenants: Array<{
    tenantId: string;
    businessName: string;
    mailMode: string;
    smtpConfigured: boolean;
    imapConfigured: boolean;
    messagingPublicKey: string;
    messagingKeySource: string | null;
    mailHealthDone: boolean;
    messagingEmbedDone: boolean;
  }>;
};

export type PlatformInfrastructureCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type PlatformInfrastructurePayload = {
  generatedAt: string;
  score: number;
  runtime: {
    nodeVersion: string;
    nodeEnv: string;
    port: number;
    uptimeSec: number;
    dataDir: string;
    appVersion: string;
    deployRef: string | null;
    platformSessionEpoch: number;
  };
  mail: {
    smtpConfigured: boolean;
    smtpHost: string | null;
    smtpPort: number;
    from: string | null;
    opsEmail: string | null;
    smtpHostHint: string | null;
    imapConfigured: boolean;
    imapHost: string | null;
    imapUser: string | null;
    lertaBridge: boolean;
  };
  outbox: {
    counts: { pending: number; sent: number; failed: number };
    byTenant: Array<{ tenantId: string; pending: number; sent: number; failed: number }>;
    failedAlertThreshold: number;
  };
  isolation: {
    ok: boolean;
    checks: PlatformInfrastructureCheck[];
    dataPaths: string[];
    envHints: string[];
  };
  storage: Array<{ name: string; path: string; sizeBytes: number | null }>;
  backup: {
    backupRoot: string;
    count: number;
    latest: { name: string; at: string; sizeBytes: number } | null;
    unreadable?: boolean;
  };
  cronJobs: Array<{ id: string; path: string; installed: boolean; sample: string }>;
  retention: { outboxDays: number; messagingDays: number; contactDays: number };
};

export async function fetchPlatformAuditOverview(days = 30): Promise<{
  ok: boolean;
  data?: PlatformAuditPayload;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/audit?days=${days}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformAuditPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Denetim özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformAuditPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function downloadPlatformAuditCsv(days = 90): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/platform/audit/export.csv?days=${days}`, {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-denetim-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformBillingOverview(days = 30): Promise<{
  ok: boolean;
  data?: PlatformBillingPayload;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/billing?days=${days}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformBillingPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Gelir özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformBillingPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function downloadPlatformBillingCsv(days = 30): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/platform/billing/export.csv?days=${days}`, {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-gelir-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformSupportOverview(days?: number): Promise<{
  ok: boolean;
  data?: PlatformSupportPayload;
  error?: string;
}> {
  try {
    const q = days != null && days > 0 ? `?days=${days}` : '';
    const res = await fetch(`/api/platform/support${q}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Destek özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformSupportPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformSupportSlaPolicy(
  patch: Partial<PlatformSupportSlaPolicy>,
): Promise<{ ok: boolean; policy?: PlatformSupportSlaPolicy; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/policy', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { ok?: boolean; policy?: PlatformSupportSlaPolicy; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Politika kaydedilemedi' };
    }
    return { ok: true, policy: data.policy };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportInboxAttachment = {
  id: string;
  fileName: string;
  mimeType?: string;
  size?: number;
};

export type PlatformSupportInboxMessage = {
  id: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  threadRootId?: string | null;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  bodyText: string;
  bodyHtml?: string | null;
  readAt: string | null;
  autoreplySentAt: string | null;
  repliedAt?: string | null;
  externalTicketRef: string | null;
  outboxStatus?: string;
  source?: string;
  attachments?: PlatformSupportInboxAttachment[];
};

export type PlatformSupportInboxPayload = {
  mailbox: {
    configured: boolean;
    address: string;
    imapUser: string;
    separateMailbox: boolean;
    autoreplyFrom: string;
    fallbackToPlatformImap?: boolean;
  };
  lastSyncAt: string | null;
  messages: PlatformSupportInboxMessage[];
  unread: number;
  total: number;
  folder?: 'inbound' | 'sent';
};

export type PlatformSupportSentReply = {
  id: string;
  sentAt: string;
  kind: string;
  kindLabel: string;
  to: string | null;
  subject: string | null;
  preview: string | null;
  htmlPreview?: string | null;
  messageId?: string | null;
  caseNumber?: number | null;
  caseId?: string | null;
  inboxMessageId?: string | null;
  repliedBy?: string | null;
};

export async function fetchPlatformSupportInbox(
  folder: 'inbound' | 'sent' = 'inbound',
): Promise<{
  ok: boolean;
  data?: PlatformSupportInboxPayload;
  sent?: PlatformSupportSentReply[];
  error?: string;
}> {
  try {
    const params = folder === 'sent' ? '?folder=sent' : '';
    const res = await fetch(`/api/platform/support/inbox${params}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportInboxPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Gelen kutusu yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    if (folder === 'sent') {
      return {
        ok: true,
        data: payload as PlatformSupportInboxPayload,
        sent: (payload.messages ?? []) as unknown as PlatformSupportSentReply[],
      };
    }
    return { ok: true, data: payload as PlatformSupportInboxPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function syncPlatformSupportInbox(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const result = await platformSecurityPost<{ message?: string }>('/api/platform/support/inbox/sync', {});
  if (!result.ok) return result;
  return { ok: true, message: result.data?.message };
}

export async function fetchPlatformSupportCaseTags(): Promise<{
  ok: boolean;
  tags?: string[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/cases/tags', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as { ok?: boolean; tags?: string[]; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Etiketler yüklenemedi' };
    }
    return { ok: true, tags: data.tags ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function markPlatformSupportInboxRead(
  messageIds: string[],
): Promise<{ ok: boolean; marked?: number; error?: string }> {
  const result = await platformSecurityPost<{ marked?: number }>('/api/platform/support/inbox/mark-read', {
    messageIds,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, marked: result.data?.marked };
}

export async function replyPlatformSupportInbox(
  messageId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await platformSecurityPost('/api/platform/support/inbox/reply', { messageId, body });
  return { ok: result.ok, error: result.error };
}

export async function downloadPlatformSupportInboxAttachment(
  inboxMessageId: string,
  attachmentId: string,
  fileName: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `/api/platform/support/inbox/${encodeURIComponent(inboxMessageId)}/attachment/${encodeURIComponent(attachmentId)}`,
      { headers: posApiAuthHeaders() },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? 'Ek indirilemedi' };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'ek';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportCase = {
  id: string;
  number: number;
  kind: 'request' | 'incident' | 'system';
  channel: string;
  status: 'new' | 'open' | 'pending' | 'solved' | 'closed';
  priority: string;
  tenantId: string | null;
  businessName: string | null;
  subject: string;
  requesterName: string | null;
  requesterEmail: string | null;
  assignee: string | null;
  tags: string[];
  links: {
    inboxMessageId: string | null;
    threadId: string | null;
    tenantId: string | null;
    contactMessageId: string | null;
    alertKind: string | null;
  };
  externalTicketRef: { provider: string; id: string; url: string | null } | null;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string;
  activity?: Array<{
    id: string;
    type: string;
    body: string;
    html?: string | null;
    channel: string | null;
    createdAt: string;
    createdBy: string;
  }>;
};

export type PlatformSupportCaseDetail = {
  case: PlatformSupportCase;
  messagingPreview: {
    thread: { id: string; customerName?: string };
    messages: Array<{ id: string; direction: string; bodyText: string; createdAt: string; authorName?: string }>;
  } | null;
  inboxSnippet: {
    id: string;
    subject: string;
    from: string;
    snippet: string;
    receivedAt: string;
  } | null;
  emailPreview: {
    rootInboxId: string;
    plusAddress: string | null;
    messages: Array<{
      id: string;
      from: string;
      subject: string;
      bodyText: string;
      bodyHtml?: string | null;
      receivedAt: string;
      isReply: boolean;
      attachments?: PlatformSupportInboxAttachment[];
    }>;
    outboundEvents: Array<{
      at: string;
      kind: string;
      messageId: string | null;
      inboxMessageId: string | null;
      textPreview?: string | null;
      htmlPreview?: string | null;
    }>;
  } | null;
  contactFormPreview?: {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    createdAt: string;
  } | null;
  macros: Array<{ id: string; label: string; body: string }>;
  aiCapabilities?: {
    externalEnabled: boolean;
    provider: string;
    model: string;
  };
};

export type PlatformSupportContactQueueItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  messagePreview: string;
  message?: string;
  createdAt: string;
  hasCase: boolean;
  caseId: string | null;
  caseNumber: number | null;
};

export type PlatformSupportSmokeFilters = {
  hideSmoke: boolean;
  tenantIds: string[];
  subjectPatterns: string[];
  customerNamePatterns: string[];
  slaHumanOnly?: boolean;
  messagingChannels?: string[];
};

export type PlatformSupportCasesPayload = {
  generatedAt: string;
  totals: PlatformSupportPayload['cases'];
  cases: PlatformSupportCase[];
};

export async function fetchPlatformSupportCases(
  status?: string,
  kind?: string,
  tag?: string,
  limit?: number,
): Promise<{ ok: boolean; data?: PlatformSupportCasesPayload; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (kind) params.set('kind', kind);
    if (tag && tag !== 'all') params.set('tag', tag);
    if (limit != null && limit > 0) params.set('limit', String(limit));
    const q = params.toString() ? `?${params}` : '';
    const res = await fetch(`/api/platform/support/cases${q}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportCasesPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Talepler yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformSupportCasesPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function updatePlatformSupportCase(
  caseId: string,
  patch: Partial<PlatformSupportCase> & { externalTicketRef?: PlatformSupportCase['externalTicketRef'] | null },
): Promise<{
  ok: boolean;
  case?: PlatformSupportCase;
  zendeskSync?: { ok: boolean; zendeskStatus?: string; error?: string };
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/support/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      case?: PlatformSupportCase;
      zendeskSync?: { ok: boolean; zendeskStatus?: string; error?: string };
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Kayıt güncellenemedi' };
    }
    return { ok: true, case: data.case, zendeskSync: data.zendeskSync };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportZendeskBridge = {
  ok?: boolean;
  subdomain: string;
  webhookConfigured: boolean;
  apiConfigured: boolean;
  ticketUrlBase: string | null;
};

export type PlatformMentionOperator = {
  username: string;
  displayName: string;
  recoveryEmail: string | null;
};

export async function fetchPlatformSupportMentionOperators(): Promise<{
  ok: boolean;
  operators?: PlatformMentionOperator[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/mention-operators', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as { ok?: boolean; operators?: PlatformMentionOperator[]; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? 'Operatör listesi alınamadı' };
    return { ok: true, operators: data.operators ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformSupportAssigneeOptions(): Promise<{
  ok: boolean;
  operators?: Array<{ username: string; displayName: string }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/assignee-options', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      operators?: Array<{ username: string; displayName: string }>;
      error?: string;
    };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? 'Atama listesi alınamadı' };
    return { ok: true, operators: data.operators ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformMentionInboxItem = {
  id: string;
  username: string;
  caseId: string;
  caseNumber: number;
  subject: string;
  authorUsername: string;
  preview: string;
  readAt: string | null;
  createdAt: string;
};

export async function fetchPlatformSupportMentionInbox(): Promise<{
  ok: boolean;
  items?: PlatformMentionInboxItem[];
  unread?: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/mention-inbox', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      items?: PlatformMentionInboxItem[];
      unread?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? 'Mention kutusu alınamadı' };
    return { ok: true, items: data.items ?? [], unread: data.unread ?? 0 };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformSupportZendeskBridge(): Promise<{
  ok: boolean;
  data?: PlatformSupportZendeskBridge;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/zendesk/bridge', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportZendeskBridge & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Zendesk yapılandırması alınamadı' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function pushPlatformSupportCaseZendesk(
  caseId: string,
): Promise<{ ok: boolean; ticketId?: string; url?: string | null; error?: string }> {
  try {
    const res = await fetch(`/api/platform/support/cases/${encodeURIComponent(caseId)}/zendesk/push`, {
      method: 'POST',
      headers: posApiAuthHeaders(),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ticketId?: string;
      url?: string | null;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Zendesk gönderimi başarısız' };
    }
    return { ok: true, ticketId: data.ticketId, url: data.url };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function createPlatformSupportCaseZendesk(
  caseId: string,
): Promise<{ ok: boolean; ticketId?: string; url?: string | null; error?: string }> {
  try {
    const res = await fetch(`/api/platform/support/cases/${encodeURIComponent(caseId)}/zendesk/create`, {
      method: 'POST',
      headers: posApiAuthHeaders(),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ticketId?: string;
      url?: string | null;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Zendesk ticket oluşturulamadı' };
    }
    return { ok: true, ticketId: data.ticketId, url: data.url };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportMacro = { id: string; label: string; body: string };

export async function fetchPlatformSupportMacros(): Promise<{
  ok: boolean;
  macros?: PlatformSupportMacro[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/macros', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as { ok?: boolean; macros?: PlatformSupportMacro[]; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Makrolar yüklenemedi' };
    }
    return { ok: true, macros: data.macros ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformSupportMacros(
  macros: PlatformSupportMacro[],
): Promise<{ ok: boolean; macros?: PlatformSupportMacro[]; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/macros', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ macros }),
    });
    const data = (await res.json()) as { ok?: boolean; macros?: PlatformSupportMacro[]; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Makrolar kaydedilemedi' };
    }
    return { ok: true, macros: data.macros };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function syncPlatformSupportCaseZendeskStatus(
  caseId: string,
): Promise<{ ok: boolean; zendeskStatus?: string; error?: string }> {
  try {
    const res = await fetch(
      `/api/platform/support/cases/${encodeURIComponent(caseId)}/zendesk/sync-status`,
      { method: 'POST', headers: posApiAuthHeaders() },
    );
    const data = (await res.json()) as { ok?: boolean; zendeskStatus?: string; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Zendesk durum senkronu başarısız' };
    }
    return { ok: true, zendeskStatus: data.zendeskStatus };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function createPlatformSupportCaseFromQueue(payload: {
  tenantId: string;
  threadId: string;
  businessName?: string;
  subject?: string;
  customerName?: string;
}): Promise<{ ok: boolean; case?: PlatformSupportCase; duplicate?: boolean; error?: string }> {
  const result = await platformSecurityPost<{ case?: PlatformSupportCase; duplicate?: boolean }>(
    '/api/platform/support/cases/from-queue',
    payload,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    case: result.data?.case,
    duplicate: Boolean(result.data?.duplicate),
  };
}

export async function fetchPlatformSupportCaseDetail(
  caseId: string,
): Promise<{ ok: boolean; data?: PlatformSupportCaseDetail; error?: string }> {
  try {
    const res = await fetch(`/api/platform/support/cases/${caseId}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportCaseDetail & { ok?: boolean; error?: string; case?: PlatformSupportCase };
    if (!res.ok || !data.ok || !data.case) {
      return { ok: false, error: data.error ?? 'Detay yüklenemedi' };
    }
    return {
      ok: true,
      data: {
        case: data.case,
        messagingPreview: data.messagingPreview ?? null,
        inboxSnippet: data.inboxSnippet ?? null,
        emailPreview: data.emailPreview ?? null,
        contactFormPreview: data.contactFormPreview ?? null,
        macros: data.macros ?? [],
        aiCapabilities: data.aiCapabilities,
      },
    };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function postPlatformSupportCaseAction(
  caseId: string,
  payload: { channel: 'note' | 'email' | 'messaging'; body: string },
): Promise<{ ok: boolean; error?: string }> {
  const result = await platformSecurityPost(`/api/platform/support/cases/${caseId}/action`, payload);
  return { ok: result.ok, error: result.error };
}

export async function fetchPlatformSupportContactQueue(limit = 80): Promise<{
  ok: boolean;
  data?: { items: PlatformSupportContactQueueItem[]; withoutCase: number; total?: number };
  error?: string;
}> {
  try {
    const q = limit > 0 ? `?limit=${limit}` : '';
    const res = await fetch(`/api/platform/support/contact-queue${q}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      items?: PlatformSupportContactQueueItem[];
      withoutCase?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'İletişim kuyruğu yüklenemedi' };
    }
    return { ok: true, data: { items: data.items ?? [], withoutCase: data.withoutCase ?? 0 } };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function createPlatformSupportCaseFromInbox(
  messageId: string,
): Promise<{ ok: boolean; case?: PlatformSupportCase; duplicate?: boolean; error?: string }> {
  const result = await platformSecurityPost<{ case?: PlatformSupportCase; duplicate?: boolean }>(
    '/api/platform/support/cases/from-inbox',
    { messageId },
  );
  if (!result.ok) return { ok: false, error: result.error };
  const caseRow = result.data?.case;
  return {
    ok: true,
    case: caseRow,
    duplicate: Boolean(result.data?.duplicate),
  };
}

export async function createPlatformSupportCaseFromContact(
  contactId: string,
): Promise<{ ok: boolean; case?: PlatformSupportCase; duplicate?: boolean; error?: string }> {
  const result = await platformSecurityPost<{ case?: PlatformSupportCase; duplicate?: boolean }>(
    '/api/platform/support/cases/from-contact',
    { contactId },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    case: result.data?.case,
    duplicate: Boolean(result.data?.duplicate),
  };
}

export async function fetchPlatformSupportSmokeFilters(): Promise<{
  ok: boolean;
  filters?: PlatformSupportSmokeFilters;
  path?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/smoke-filters', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      filters?: PlatformSupportSmokeFilters;
      path?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Smoke filtreleri yüklenemedi' };
    }
    return { ok: true, filters: data.filters, path: data.path };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportSmokePreview = {
  hideSmoke: boolean;
  hiddenTotal: number;
  visibleTotal: number;
  samples: Array<{
    tenantId: string;
    businessName: string;
    threadId: string;
    subject: string;
    customerName: string;
    reason: string;
    reasonCode: string;
  }>;
};

export async function previewPlatformSupportSmokeFilters(
  filters?: PlatformSupportSmokeFilters,
): Promise<{ ok: boolean; data?: PlatformSupportSmokePreview; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/smoke-filters/preview', {
      method: 'POST',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, sampleLimit: 30 }),
    });
    const data = (await res.json()) as PlatformSupportSmokePreview & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Önizleme başarısız' };
    }
    return {
      ok: true,
      data: {
        hideSmoke: data.hideSmoke,
        hiddenTotal: data.hiddenTotal,
        visibleTotal: data.visibleTotal,
        samples: data.samples ?? [],
      },
    };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportSkillRow = {
  id: string;
  label: string;
  assignees: string[];
  maxOpenCases: number;
};

export type PlatformSupportSkillsHub = {
  skills: PlatformSupportSkillRow[];
  channelMap: Record<string, string>;
  tagMap: Record<string, string>;
};

export async function fetchPlatformSupportSkills(): Promise<{
  ok: boolean;
  skills?: PlatformSupportSkillRow[];
  channelMap?: Record<string, string>;
  tagMap?: Record<string, string>;
  path?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/skills', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportSkillsHub & { ok?: boolean; error?: string; path?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Skill yüklenemedi' };
    }
    return {
      ok: true,
      skills: data.skills,
      channelMap: data.channelMap,
      tagMap: data.tagMap,
      path: data.path,
    };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformSupportSkills(
  hub: PlatformSupportSkillsHub,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/skills', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(hub),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Skill kaydedilemedi' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformSupportSmokeFilters(
  filters: PlatformSupportSmokeFilters,
): Promise<{ ok: boolean; filters?: PlatformSupportSmokeFilters; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/smoke-filters', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    });
    const data = (await res.json()) as { ok?: boolean; filters?: PlatformSupportSmokeFilters; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Filtre kaydedilemedi' };
    }
    return { ok: true, filters: data.filters };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportTenant360UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
  engagement?: string;
};

export type PlatformSupportTenant360LoginRow = {
  id?: string;
  username?: string;
  displayName?: string;
  success: boolean;
  method?: string;
  createdAt: string;
  failureReason?: string | null;
  clientIp?: string | null;
};

export type PlatformSupportTenant360Payload = {
  tenantId: string;
  businessName: string;
  demo: boolean;
  lifecycle: {
    statusLabel: string;
    suspended: boolean;
    readOnly: boolean;
  } | null;
  userRoster?: PlatformSupportTenant360UserRow[];
  loginAlerts?: PlatformSupportTenant360LoginRow[];
  loginActivity?: PlatformSupportTenant360LoginRow[];
  loginSummary?: {
    totalUsers: number;
    activeCount: number;
    loginSuccess30d: number;
    loginFailed30d: number;
  } | null;
  accounting: {
    receivablesTotalTry: number;
    debtorsCount: number;
    overduePaymentCount: number;
    overduePaymentAmountTry: number;
    collections30dTry?: number;
    pendingPaymentCount?: number;
  };
  stock: {
    productCount: number;
    lowStockCount: number;
    lowStockSample: Array<{ id: string; name: string; stock: number }>;
  };
  sales: { recentSaleCount30d: number; revenue30dTry: number };
  security: {
    securityScore: number;
    loginFailed30d: number;
    loginSuccess30d: number;
  } | null;
  comms: {
    outbox: { pending: number; sent: number; failed: number };
    messaging: { open?: number; pendingFirstResponse?: number };
  };
  openCases: Array<{ id: string; number: number; subject: string }>;
};

export async function fetchPlatformSupportTenant360(
  tenantId: string,
): Promise<{ ok: boolean; data?: PlatformSupportTenant360Payload; error?: string }> {
  try {
    const res = await fetch(
      `/api/platform/support/tenant-360?tenantId=${encodeURIComponent(tenantId)}`,
      { headers: posApiAuthHeaders() },
    );
    const data = (await res.json()) as PlatformSupportTenant360Payload & {
      ok?: boolean;
      error?: string;
      generatedAt?: string;
      users?: unknown;
      quickLinks?: unknown;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? '360 yüklenemedi' };
    }
    return {
      ok: true,
      data: {
        tenantId: data.tenantId,
        businessName: data.businessName,
        demo: data.demo,
        lifecycle: data.lifecycle,
        userRoster: data.userRoster ?? [],
        loginAlerts: data.loginAlerts ?? [],
        loginActivity: data.loginActivity ?? [],
        loginSummary: data.loginSummary ?? null,
        accounting: data.accounting,
        stock: data.stock,
        sales: data.sales,
        security: data.security,
        comms: data.comms,
        openCases: data.openCases,
      },
    };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function postPlatformSupportCommand(payload: {
  tenantId?: string;
  command?: string;
  line?: string;
}): Promise<{ ok: boolean; error?: string; hints?: string[] }> {
  const result = await platformSecurityPost('/api/platform/support/command', payload);
  const hints = (result as { hints?: string[] }).hints;
  return { ok: result.ok, error: result.error, hints };
}

export type PlatformSupportCommandHelp = { id: string; label: string; example: string };

export async function fetchPlatformSupportCommands(): Promise<{
  ok: boolean;
  commands?: PlatformSupportCommandHelp[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/support/commands', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as {
      ok?: boolean;
      commands?: PlatformSupportCommandHelp[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Komut listesi alınamadı' };
    }
    return { ok: true, commands: data.commands ?? [] };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportSlaLivePayload = {
  generatedAt: string;
  windowDays: number;
  compliancePercent: number | null;
  totals: {
    queueSize: number;
    pendingFirstResponse: number;
    slaBreaches: number;
    slaMet: number;
    openThreads: number;
  };
  queueBySeverity: { critical: number; warning: number; info: number };
  caseOverdue: number;
  overdueCases?: Array<{
    id: string;
    number: number;
    subject: string;
    status: string;
    tenantId: string | null;
    businessName: string | null;
    slaDueAt: string;
    overdueMs: number;
  }>;
  daily: Array<{ dateKey: string; met: number; breached: number; samples: number }>;
  topQueue: Array<{
    id: string;
    tenantId?: string;
    threadId?: string;
    severity: string;
    businessName: string;
    subject: string;
    waitMs: number;
  }>;
  apologyQueue?: {
    generatedAt: string;
    count: number;
    items: Array<{
      id: string;
      number: number;
      subject: string;
      tenantId: string | null;
      businessName: string | null;
      requesterEmail: string;
      slaDueAt: string;
      overdueMs: number;
    }>;
  };
};

export async function postPlatformSupportSlaApologyBatch(caseIds: string[]): Promise<{
  ok: boolean;
  sent?: number;
  failed?: number;
  results?: Array<{ caseId: string; ok: boolean; error?: string }>;
  error?: string;
}> {
  const result = await platformSecurityPost<{ sent?: number; failed?: number; results?: Array<{ caseId: string; ok: boolean; error?: string }> }>(
    '/api/platform/support/sla-apology',
    { caseIds },
  );
  return {
    ok: result.ok,
    sent: result.data?.sent,
    failed: result.data?.failed,
    results: result.data?.results,
    error: result.error,
  };
}

export async function fetchPlatformSupportSlaLive(
  days?: number,
): Promise<{ ok: boolean; data?: PlatformSupportSlaLivePayload; error?: string }> {
  try {
    const q = days != null && days > 0 ? `?days=${days}` : '';
    const res = await fetch(`/api/platform/support/sla-live${q}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSupportSlaLivePayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'SLA paneli yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformSupportSlaLivePayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export type PlatformSupportCaseAiKind =
  | 'summary'
  | 'draft_reply'
  | 'apply_macro'
  | 'personalize_macro'
  | 'refine_draft';

export async function fetchPlatformSupportCaseAi(
  caseId: string,
  kind: PlatformSupportCaseAiKind,
  options?: { macroId?: string; draft?: string },
): Promise<{ ok: boolean; text?: string; provider?: string; error?: string }> {
  const result = await platformSecurityPost(`/api/platform/support/cases/${caseId}/ai`, {
    kind,
    macroId: options?.macroId,
    draft: options?.draft,
  });
  const text = (result as { text?: string }).text;
  const provider = (result as { provider?: string }).provider;
  return { ok: result.ok, text, provider, error: result.error };
}

export type PlatformSupportCaseActivityExportFilter =
  | 'all'
  | 'email_inbound'
  | 'email_outbound'
  | 'note'
  | 'zendesk'
  | 'case_meta'
  | 'messaging';

export async function createPlatformSupportCaseManual(payload: {
  subject: string;
  kind?: PlatformSupportCase['kind'];
  channel?: string;
  requesterEmail?: string;
  requesterName?: string;
  tenantId?: string | null;
  businessName?: string | null;
  notes?: string;
  priority?: string;
}): Promise<{ ok: boolean; case?: PlatformSupportCase; error?: string }> {
  const result = await platformSecurityPost<{ case?: PlatformSupportCase }>('/api/platform/support/cases', {
    kind: payload.kind ?? 'request',
    channel: payload.channel ?? 'manual',
    status: 'new',
    subject: payload.subject,
    requesterEmail: payload.requesterEmail,
    requesterName: payload.requesterName,
    tenantId: payload.tenantId,
    businessName: payload.businessName,
    notes: payload.notes,
    priority: payload.priority ?? 'normal',
  });
  if (!result.ok) return { ok: false, error: result.error };
  const caseRow = result.data?.case;
  return caseRow ? { ok: true, case: caseRow } : { ok: false, error: 'Kayıt yanıtı eksik' };
}

export async function downloadPlatformSupportCaseActivityCsv(
  caseId: string,
  filter: PlatformSupportCaseActivityExportFilter = 'all',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const q = filter && filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : '';
    const res = await fetch(
      `/api/platform/support/cases/${encodeURIComponent(caseId)}/activity/export.csv${q}`,
      {
        headers: posApiAuthHeaders(),
      },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const nameMatch = disposition.match(/filename="([^"]+)"/);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nameMatch?.[1] ?? `destek-aktivite-${caseId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function openPlatformSupportCaseActivityPrint(
  caseId: string,
  filter: PlatformSupportCaseActivityExportFilter = 'all',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const q = filter && filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : '';
    const res = await fetch(
      `/api/platform/support/cases/${encodeURIComponent(caseId)}/activity/export.html${q}`,
      {
        headers: posApiAuthHeaders(),
      },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'Dışa aktarma açılamadı' };
    }
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function downloadPlatformSupportContactQueueCsv(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/platform/support/contact-queue/export.csv', {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-iletisim-formu-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function downloadPlatformSupportCsv(days?: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const q = days != null && days > 0 ? `?days=${days}` : '';
    const res = await fetch(`/api/platform/support/export.csv${q}`, {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-destek-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformSettingsOverview(): Promise<{
  ok: boolean;
  data?: PlatformSettingsPayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/settings', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformSettingsPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Yapılandırma yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformSettingsPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformConsoleSettings(
  patch: Partial<PlatformConsoleSettings>,
): Promise<{ ok: boolean; console?: PlatformConsoleSettings; error?: string }> {
  try {
    const res = await fetch('/api/platform/settings', {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { ok?: boolean; console?: PlatformConsoleSettings; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Ayarlar kaydedilemedi' };
    }
    return { ok: true, console: data.console };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformIntegrationsOverview(): Promise<{
  ok: boolean;
  data?: PlatformIntegrationsPayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/integrations', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformIntegrationsPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Entegrasyon özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformIntegrationsPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function runPlatformIntegrationsProbe(options: {
  smtp?: boolean;
  imap?: boolean;
  engagementWebhook?: boolean;
  securityWebhook?: boolean;
}): Promise<{
  ok: boolean;
  probes?: Record<string, { ok?: boolean; skipped?: boolean; error?: string; status?: number }>;
  error?: string;
}> {
  const result = await platformSecurityPost<{ probes?: Record<string, unknown> }>(
    '/api/platform/integrations/probe',
    options,
  );
  if (!result.ok) return result;
  return { ok: true, probes: result.data?.probes as Record<string, { ok?: boolean; skipped?: boolean; error?: string; status?: number }> };
}

export async function downloadPlatformIntegrationsCsv(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/platform/integrations/export.csv', { headers: posApiAuthHeaders() });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-entegrasyon-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformInfrastructureOverview(): Promise<{
  ok: boolean;
  data?: PlatformInfrastructurePayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/infrastructure', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformInfrastructurePayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Altyapı özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformInfrastructurePayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function runPlatformInfrastructureProbe(): Promise<{
  ok: boolean;
  probes?: {
    smtp?: { ok: boolean; error?: string | null };
    imap?: { ok: boolean; error?: string | null; message?: string | null };
  };
  error?: string;
}> {
  const result = await platformSecurityPost<{
    probes?: {
      smtp?: { ok: boolean; error?: string | null };
      imap?: { ok: boolean; error?: string | null; message?: string | null };
    };
  }>('/api/platform/infrastructure/probe', {});
  if (!result.ok) return result;
  return { ok: true, probes: result.data?.probes };
}

export async function fetchPlatformTenantsLifecycle(): Promise<{
  ok: boolean;
  data?: PlatformTenantLifecyclePayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/tenants/lifecycle', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformTenantLifecyclePayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Kiracı listesi yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformTenantLifecyclePayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function savePlatformTenantLifecycle(
  tenantId: string,
  patch: {
    suspended?: boolean;
    readOnly?: boolean;
    opsNotes?: string;
    plan?: string;
    trialEndsAt?: string | null;
  },
): Promise<{ ok: boolean; tenant?: PlatformTenantLifecycleRow; error?: string }> {
  try {
    const res = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`, {
      method: 'PUT',
      headers: { ...posApiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      tenant?: PlatformTenantLifecycleRow;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Kaydedilemedi' };
    }
    return { ok: true, tenant: data.tenant };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformCommsOverview(days = 14): Promise<{
  ok: boolean;
  data?: PlatformCommsPayload;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/comms?days=${days}`, { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformCommsPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Posta/mesaj özeti yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformCommsPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function downloadPlatformCommsCsv(days = 14): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/platform/comms/export.csv?days=${days}`, {
      headers: posApiAuthHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? 'CSV indirilemedi' };
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-posta-mesaj-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function platformCommsProcessOutbox(limit = 30): Promise<{
  ok: boolean;
  processed?: {
    processed: number;
    sent: number;
    failed: number;
    deferred: number;
  };
  error?: string;
}> {
  const result = await platformSecurityPost<{
    processed: { processed: number; sent: number; failed: number; deferred: number };
  }>('/api/platform/comms/outbox/process', { limit });
  if (!result.ok) return result;
  return { ok: true, processed: result.data?.processed };
}

export async function platformCommsRequeueFailed(options?: {
  tenantId?: string;
  all?: boolean;
  ids?: string[];
}): Promise<{ ok: boolean; requeued?: number; errors?: Array<{ id: string; error: string }>; error?: string }> {
  const result = await platformSecurityPost<{
    requeued: number;
    errors?: Array<{ id: string; error: string }>;
  }>('/api/platform/comms/outbox/requeue', {
    tenantId: options?.tenantId,
    all: options?.all ?? true,
    ids: options?.ids ?? [],
  });
  if (!result.ok) return result;
  return { ok: true, requeued: result.data?.requeued, errors: result.data?.errors };
}

export async function fetchPlatformUserOperations(): Promise<{
  ok: boolean;
  data?: PlatformUserOperationsPayload;
  error?: string;
}> {
  try {
    const res = await fetch('/api/platform/users', { headers: posApiAuthHeaders() });
    const data = (await res.json()) as PlatformUserOperationsPayload & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Kullanıcı işlemleri yüklenemedi' };
    }
    const { ok: _ok, error: _err, ...payload } = data;
    return { ok: true, data: payload as PlatformUserOperationsPayload };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}

export async function fetchPlatformTenantDetail(tenantId: string): Promise<{
  ok: boolean;
  tenant?: PlatformTenantSummary & {
    users: PlatformTenantUserRow[];
    topDebtors: PlatformDebtorRow[];
    upcomingPayments: PlatformPaymentRow[];
  };
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}`, {
      headers: posApiAuthHeaders(),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      tenant?: PlatformTenantSummary & {
        users: PlatformTenantUserRow[];
        topDebtors: PlatformDebtorRow[];
        upcomingPayments: PlatformPaymentRow[];
      };
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Detay alınamadı' };
    }
    return { ok: true, tenant: data.tenant };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
  }
}
