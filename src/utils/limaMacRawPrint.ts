const LIMA_RAW_PRINT_URL =
  typeof import.meta.env?.VITE_LIMA_RAW_PRINT_URL === 'string' &&
  import.meta.env.VITE_LIMA_RAW_PRINT_URL
    ? import.meta.env.VITE_LIMA_RAW_PRINT_URL
    : 'http://127.0.0.1:18765/print';

const RAW_PRINT_TIMEOUT_MS = 4500;

/** Mac’te lima-mac-raw-print.mjs — CUPS rastertopos (c0) atlanır */
export async function tryLimaMacRawReceiptPrint(text: string): Promise<boolean> {
  try {
    const res = await fetch(LIMA_RAW_PRINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(RAW_PRINT_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function isLimaMacRawPrintAvailable(): Promise<boolean> {
  try {
    const base = LIMA_RAW_PRINT_URL.replace(/\/print\/?$/, '');
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}
