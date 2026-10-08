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
