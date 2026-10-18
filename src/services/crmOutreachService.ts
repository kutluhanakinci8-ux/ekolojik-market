import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders } from './posApiAuth';

export async function sendCrmEmailApi(payload: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}): Promise<{ ok: boolean; error?: string; provider?: string; message?: string }> {
  const tenant = loadTenantId();
  const url = !tenant || tenant === DEFAULT_TENANT_ID
    ? '/api/crm/send-email'
    : `/api/crm/send-email?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json() as { ok: boolean; error?: string; provider?: string; message?: string };
  if (!res.ok) return { ok: false, error: data.error ?? 'E-posta gönderilemedi' };
  return data;
}

export async function fetchCrmSmsConfigured(): Promise<{ ok: boolean; configured?: boolean }> {
  const tenant = loadTenantId();
  const url = !tenant || tenant === DEFAULT_TENANT_ID
    ? '/api/crm/sms-configured'
    : `/api/crm/sms-configured?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(url, { headers: posApiAuthHeaders() });
  const data = (await res.json()) as { ok: boolean; configured?: boolean };
  if (!res.ok) return { ok: false };
  return data;
}

export async function sendCrmSmsApi(payload: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; provider?: string; messageId?: string }> {
  const tenant = loadTenantId();
  const url = !tenant || tenant === DEFAULT_TENANT_ID
    ? '/api/crm/send-sms'
    : `/api/crm/send-sms?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    provider?: string;
    messageId?: string;
  };
  if (!res.ok) return { ok: false, error: data.error ?? 'SMS gönderilemedi' };
  return data;
}
