import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { loadPosApiToken, posApiAuthHeaders } from './posApiAuth';

/** Posta / mesajlaşma hub API — tenant query + POS Bearer token */
export function withTenantQuery(path: string): string {
  const tenant = loadTenantId();
  if (!tenant || tenant === DEFAULT_TENANT_ID) return path;
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}tenant=${encodeURIComponent(tenant)}`;
}

export async function posHubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const extra =
    init.headers && typeof init.headers === 'object' && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : undefined;
  return fetch(withTenantQuery(path), {
    ...init,
    headers: posApiAuthHeaders(extra),
  });
}

export function postaEventsStreamUrl(): string {
  return postaAuthenticatedUrl('/api/posta/events');
}

/** Tarayıcı `<a href>` / yeni sekme — Bearer header gönderilemez */
export function postaAuthenticatedUrl(path: string): string {
  const token = loadPosApiToken();
  let url = withTenantQuery(path);
  if (!token) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}access_token=${encodeURIComponent(token)}`;
}
