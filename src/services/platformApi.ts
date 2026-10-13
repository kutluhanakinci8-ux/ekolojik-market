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
