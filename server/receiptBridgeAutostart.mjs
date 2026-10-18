import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PORT = Number(process.env.LIMA_RAW_PRINT_PORT || 18765);
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;

let bridgeChild = null;

export async function receiptBridgeHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data.ok === true;
  } catch {
    return false;
  }
}

async function waitForBridgeHealth(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await receiptBridgeHealth()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/**
 * Fiş köprüsü (127.0.0.1:18765) kapalıysa Node alt süreci olarak başlatır.
 * RECEIPT_BRIDGE_AUTOSTART=0 ile kapatılır (pm2 ayrı process kullanıyorsa).
 */
export async function ensureReceiptBridgeRunning(repoRoot) {
  if (await receiptBridgeHealth()) return true;
  if (process.env.RECEIPT_BRIDGE_AUTOSTART === '0') return false;

  if (bridgeChild && !bridgeChild.killed) {
    return waitForBridgeHealth(5000);
  }

  const script = join(repoRoot, 'scripts', 'lima-raw-print-bridge.mjs');
  bridgeChild = spawn(process.execPath, [script], {
    cwd: repoRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  bridgeChild.stdout?.on('data', (chunk) => {
    process.stdout.write(`[receipt-bridge] ${chunk}`);
  });
  bridgeChild.stderr?.on('data', (chunk) => {
    process.stderr.write(`[receipt-bridge] ${chunk}`);
  });
  bridgeChild.on('exit', (code) => {
    if (code != null && code !== 0) {
      console.warn(`[receipt-bridge] çıkış kodu ${code}`);
    }
    bridgeChild = null;
  });

  const ok = await waitForBridgeHealth(12_000);
  if (ok) {
    console.log(`[receipt-bridge] hazır → ${HEALTH_URL}`);
  } else {
    console.warn('[receipt-bridge] başlatıldı ama health yanıt vermedi (port dolu veya yazıcı yok)');
  }
  return ok;
}
