import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from '../services/posApiAuth';

const LOCAL_PRINT_URL =
  typeof import.meta.env?.VITE_LIMA_RAW_PRINT_URL === 'string' &&
  import.meta.env.VITE_LIMA_RAW_PRINT_URL
    ? import.meta.env.VITE_LIMA_RAW_PRINT_URL
    : 'http://127.0.0.1:18765/print';

const LOCAL_HEALTH_URL = LOCAL_PRINT_URL.replace(/\/print\/?$/, '/health');

const RAW_PRINT_TIMEOUT_MS = 8000;

export interface LimaBridgeHealth {
  ok?: boolean;
  queue?: string;
  resolvedQueue?: string;
  platform?: string;
  charset?: string;
  printerReady?: boolean;
  printerCount?: number;
  printers?: string[];
  printerError?: string;
  bridgeVersion?: string;
  fastPrintWorker?: boolean;
  workerReady?: boolean;
}

let lastRawPrintError: string | null = null;

export function getLastLimaRawPrintError(): string | null {
  return lastRawPrintError;
}

function serverThermalPrintPath(): string {
  const tenant = loadTenantId();
  const base = '/api/pos/lima-thermal-print';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

type PostRawResult = { ok: true } | { ok: false; error: string };

async function postRawReceipt(
  url: string,
  text: string,
  printerName?: string,
  usePosAuth = false,
): Promise<PostRawResult> {
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
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      resolvedQueue?: string;
      printers?: string[];
    };
    if (!res.ok || data.ok !== true) {
      const printers =
        Array.isArray(data.printers) && data.printers.length
          ? ` Mevcut: ${data.printers.join(', ')}`
          : '';
      const msg =
        data.error?.trim() ||
        (res.status === 500 ? 'Yazici gonderimi basarisiz (500)' : `HTTP ${res.status}`);
      const full = `${msg}${printers}`;
      if (typeof console !== 'undefined') {
        console.warn('[market-pos-fis] raw print:', full);
      }
      return { ok: false, error: full };
    }
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    if (typeof console !== 'undefined') {
      console.warn('[market-pos-fis] raw print failed:', err);
    }
    return { ok: false, error: msg };
  }
}

/**
 * Sessiz termal fiş — önce kasa PC köprüsü (127.0.0.1), sonra sunucu API (VPS’teki köprü).
 * Tarayıcı «Yazdır» penceresi açılmaz.
 */
function isWindowsDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.userAgent) || /Windows/i.test(navigator.platform);
}

export async function tryLimaRawReceiptPrint(
  text: string,
  printerName?: string,
): Promise<boolean> {
  lastRawPrintError = null;
  const local = await postRawReceipt(LOCAL_PRINT_URL, text, printerName, false);
  if (local.ok) return true;

  const localErr = local.error;
  const localLooksOffline =
    /failed to fetch|networkerror|fetch/i.test(localErr) ||
    /ECONNREFUSED|127\.0\.0\.1|18765/i.test(localErr);

  if (typeof window !== 'undefined' && isWindowsDesktop()) {
    lastRawPrintError = localLooksOffline
      ? 'Bu bilgisayarda fiş servisi kapalı. Ayarlar → Fiş yazıcısı → Zywell kurulum (.ps1) dosyasını bir kez çalıştırın; sonra bilgisayar her açıldığında arka planda otomatik başlar (terminal gerekmez).'
      : localErr;
    return false;
  }

  const serverUrl = `${window.location.origin}${serverThermalPrintPath()}`;
  const server = await postRawReceipt(serverUrl, text, printerName, true);
  if (server.ok) return true;

  lastRawPrintError = localLooksOffline ? localErr : server.error || localErr;
  return false;
}

export async function fetchLimaBridgeHealth(full = false): Promise<LimaBridgeHealth | null> {
  try {
    const url = full ? `${LOCAL_HEALTH_URL}?full=1` : LOCAL_HEALTH_URL;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(full ? 12000 : 6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as LimaBridgeHealth;
  } catch {
    return null;
  }
}

export async function isLimaRawPrintAvailable(): Promise<boolean> {
  const health = await fetchLimaBridgeHealth();
  if (health?.ok === true) return true;
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

/** Köprü ayakta ve (Windows’ta) yazıcı kuyruğu tanımlı */
export async function isLimaRawPrintReadyForReceipt(): Promise<{
  bridgeUp: boolean;
  printerReady: boolean;
  health: LimaBridgeHealth | null;
  message: string;
}> {
  const health = await fetchLimaBridgeHealth();
  if (!health?.ok) {
    return {
      bridgeUp: false,
      printerReady: false,
      health,
      message: 'Fiş servisi kapalı (127.0.0.1:18765)',
    };
  }
  if (health.platform === 'win32' && health.printerReady === false) {
    return {
      bridgeUp: true,
      printerReady: false,
      health,
      message: health.printerError ?? 'Windows yazıcı kuyruğu hazır değil',
    };
  }
  return {
    bridgeUp: true,
    printerReady: true,
    health,
    message: `Köprü hazır → ${health.resolvedQueue ?? health.queue ?? 'yazıcı'}`,
  };
}

/** @deprecated use tryLimaRawReceiptPrint */
export async function tryLimaMacRawReceiptPrint(text: string): Promise<boolean> {
  return tryLimaRawReceiptPrint(text);
}

/** @deprecated use isLimaRawPrintAvailable */
export async function isLimaMacRawPrintAvailable(): Promise<boolean> {
  return isLimaRawPrintAvailable();
}
