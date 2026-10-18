export async function getClientIp(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/client-ip', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { ip?: string };
    const ip = data.ip?.trim();
    return ip || undefined;
  } catch {
    return undefined;
  }
}

export function formatClientIp(ip?: string): string {
  if (!ip) return '—';
  return ip;
}
