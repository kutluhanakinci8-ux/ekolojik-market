import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from '../services/posApiAuth';

const LOCAL_PRINT_URL =
  typeof import.meta.env?.VITE_LIMA_RAW_PRINT_URL === 'string' &&
  import.meta.env.VITE_LIMA_RAW_PRINT_URL
    ? import.meta.env.VITE_LIMA_RAW_PRINT_URL
    : 'http://127.0.0.1:18765/print';

const RAW_PRINT_TIMEOUT_MS = 6000;

function serverThermalPrintPath(): string {
  const tenant = loadTenantId();
  const base = '/api/pos/lima-thermal-print';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

async function postRawReceipt(
  url: string,
  text: string,
  printerName?: string,
  usePosAuth = false,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      text,
      printer: printerName?.trim() || undefined,
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (usePosAuth) {
      Object.assign(headers, posApiAuthHeaders());
    }
    const res = usePosAuth
      ? await posApiFetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(RAW_PRINT_TIMEOUT_MS),
        })
      : await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(RAW_PRINT_TIMEOUT_MS),
        });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Sessiz termal fiş — önce kasa PC köprüsü (127.0.0.1), sonra sunucu API (VPS’teki köprü).
 * Tarayıcı «Yazdır» penceresi açılmaz.
 */
export async function tryLimaRawReceiptPrint(
  text: string,
  printerName?: string,
): Promise<boolean> {
  const attempts: { url: string; auth: boolean }[] = [
    { url: LOCAL_PRINT_URL, auth: false },
  ];
  if (typeof window !== 'undefined') {
    attempts.push({
      url: `${window.location.origin}${serverThermalPrintPath()}`,
      auth: true,
    });
  }
  for (const { url, auth } of attempts) {
    if (await postRawReceipt(url, text, printerName, auth)) return true;
  }
  return false;
}

export async function isLimaRawPrintAvailable(): Promise<boolean> {
  try {
    const res = await fetch(LOCAL_PRINT_URL.replace(/\/print\/?$/, '/health'), {
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) return true;
  } catch {
    /* local bridge off */
  }
  if (typeof window === 'undefined') return false;
  try {
    const res = await posApiFetch(`${serverThermalPrintPath()}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

/** @deprecated use tryLimaRawReceiptPrint */
export async function tryLimaMacRawReceiptPrint(text: string): Promise<boolean> {
  return tryLimaRawReceiptPrint(text);
}

/** @deprecated use isLimaRawPrintAvailable */
export async function isLimaMacRawPrintAvailable(): Promise<boolean> {
  return isLimaRawPrintAvailable();
}
