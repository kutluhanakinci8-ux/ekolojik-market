import { posApiAuthHeaders } from './posApiAuth';
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

export async function fetchPlatformTenantDetail(tenantId: string): Promise<{
  ok: boolean;
  tenant?: PlatformTenantSummary & { users: PlatformTenantUserRow[] };
  error?: string;
}> {
  try {
    const res = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}`, {
      headers: posApiAuthHeaders(),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      tenant?: PlatformTenantSummary & { users: PlatformTenantUserRow[] };
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
