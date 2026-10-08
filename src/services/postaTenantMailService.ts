import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';

function tenantQuery(): string {
  const tenant = loadTenantId();
  if (!tenant || tenant === DEFAULT_TENANT_ID) return '';
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export type TenantMailConfigHub = {
  ok: boolean;
  tenantId: string;
  usePlatformEnv: boolean;
  enabled: boolean;
  smtp: {
    host: string;
    port: number | null;
    secure: boolean | null;
    user: string;
    pass: string;
    from: string;
    fromName: string;
    replyTo: string;
  };
  imap: {
    host: string;
    port: number | null;
    secure: boolean | null;
    user: string;
    pass: string;
    inboxAddress: string;
  };
  effective: {
    smtpConfigured: boolean;
    imapConfigured: boolean;
    smtpFrom: string;
    imapUser: string;
  };
  updatedAt: string | null;
};

export async function fetchTenantMailConfig(): Promise<TenantMailConfigHub | null> {
  const res = await fetch(`/api/posta/tenant-mail${tenantQuery()}`);
  if (!res.ok) return null;
  return (await res.json()) as TenantMailConfigHub;
}

export async function saveTenantMailConfig(patch: Record<string, unknown>): Promise<TenantMailConfigHub | null> {
  const res = await fetch(`/api/posta/tenant-mail${tenantQuery()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  return (await res.json()) as TenantMailConfigHub;
}
