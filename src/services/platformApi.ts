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
};

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
