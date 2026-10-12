#!/usr/bin/env node
/**
 * Lima — sessiz termal fiş (tarayıcı yazdır penceresi YOK)
 * Mac: lp -o raw | Windows: win-raw-escpos.ps1 → POS-80C
 *
 *   node scripts/lima-raw-print-bridge.mjs
 *   set POS80_QUEUE_NAME=Printer POS-80C   (Windows, Ayarlar’daki tam ad)
 */
import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEscPosReceiptBuffer } from './escposTurkish.mjs';

const PORT = Number(process.env.LIMA_RAW_PRINT_PORT || 18765);
const QUEUE =
  process.env.POS80_QUEUE_NAME ||
  (platform() === 'win32' ? 'Ekolojik POS-80 (Zywell)' : 'Printer_POS_80C');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

function listDarwinPrintQueues() {
  try {
    const names = [];
    for (const line of execSync('lpstat -p', { encoding: 'utf8' }).split('\n')) {
      const en = /^printer\s+(\S+)/i.exec(line.trim());
      if (en) {
        names.push(en[1]);
        continue;
      }
      const first = line.trim().split(/\s+/)[0];
      if (first && first.toLowerCase() !== 'printer') names.push(first);
    }
    return names;
  } catch {
    return [];
  }
}

/** Ayarlardaki «Printer POS-80C» → CUPS «Printer_POS_80C» */
function resolveDarwinQueue(requested) {
  const want = String(requested || QUEUE).trim();
  const queues = listDarwinPrintQueues();
  if (queues.includes(want)) return want;
  const underscored = want.replace(/\s+/g, '_');
  if (queues.includes(underscored)) return underscored;
  const norm = (s) => s.toLowerCase().replace(/[\s_-]/g, '');
  const hit = queues.find((q) => norm(q) === norm(want));
  if (hit) return hit;
  const pos80 = queues.find((q) => /pos.?80/i.test(q));
  if (pos80 && /pos.?80/i.test(want)) return pos80;
  return underscored || QUEUE;
}

let win32PrinterCache = { names: [], at: 0 };
const WIN32_PRINTER_CACHE_MS = 60_000;

function listWin32Printers() {
  if (platform() !== 'win32') return [];
  const now = Date.now();
  if (win32PrinterCache.names.length && now - win32PrinterCache.at < WIN32_PRINTER_CACHE_MS) {
    return win32PrinterCache.names;
  }
  const ps = [
    '$names = @()',
    'try { $names += @(Get-Printer -ErrorAction Stop | Select-Object -ExpandProperty Name) } catch {}',
    'try {',
    '  $names += @(Get-CimInstance Win32_Printer -ErrorAction Stop | Select-Object -ExpandProperty Name)',
    '} catch {}',
    '$names | Where-Object { $_ } | Sort-Object -Unique',
  ].join('; ');
  try {
    const out = execSync(`powershell.exe -NoProfile -Command "${ps}"`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    const names = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    win32PrinterCache = { names, at: Date.now() };
    return names;
  } catch {
    return win32PrinterCache.names.length ? win32PrinterCache.names : [];
  }
}

/** Ayarlar / POS80_QUEUE_NAME → Windows «Yazıcılar» tam adı */
function resolveWin32Queue(requested) {
  const want = String(requested || QUEUE).trim();
  const printers = listWin32Printers();
  if (!printers.length) return want || QUEUE;
  if (printers.includes(want)) return want;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = printers.find((p) => norm(p) === norm(want));
  if (hit) return hit;
  const standard = printers.find((p) => /ekolojik\s+pos-80\s*\(zywell\)/i.test(p));
  if (standard) return standard;
  const pos80 = printers.filter((p) => /pos.?80|zywell|ekolojik/i.test(p));
  if (pos80.length >= 1) return pos80[0];
  if (want && /pos|80|zywell|ekolojik|printer/i.test(want) && printers.length) return printers[0];
  return want || QUEUE;
}

function win32PrinterStatus(requested) {
  const printers = listWin32Printers();
  const want = String(requested || QUEUE).trim();
  let resolved = resolveWin32Queue(want);
  if (!printers.includes(resolved)) {
    const fallback = printers.find((p) => /pos.?80|zywell|ekolojik/i.test(p));
    if (fallback) resolved = fallback;
  }
  if (!printers.length) {
    return {
      ready: false,
      requested: want,
      resolvedQueue: resolved,
      error:
        'Windows yazici listesi bos. Bluetoothta sadece "printer-80" gorunuyorsa bu yetmez: '
        + 'Ayarlar → Yazicilar ve tarayicilar → Yazici ekle (POS-80 / Generic) veya USB kullanin.',
    };
  }
  if (!printers.includes(resolved)) {
    return {
      ready: false,
      requested: want,
      resolvedQueue: resolved,
      error: `Yazici kuyrugu bulunamadi: "${resolved}". Ayarlardaki ad Windows yazici listesiyle ayni olmali.`,
      printers,
    };
  }
  return { ready: true, requested: want, resolvedQueue: resolved, printers };
}

function lpRaw(buffer, queueName) {
  const q = queueName || QUEUE;
  return new Promise((resolve, reject) => {
    const file = join(tmpdir(), `lima-raw-${Date.now()}.bin`);
    writeFileSync(file, buffer);
    const child = spawn('lp', ['-d', q, '-o', 'raw', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('close', (code) => {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
      if (code === 0) resolve();
      else reject(new Error(err || `lp exit ${code}`));
    });
  });
}

let winPrintWorker = null;
let winWorkerReady = false;
let winWorkerBuf = '';
let winPrintChain = Promise.resolve();

function ensureWinPrintWorker() {
  if (platform() !== 'win32') return;
  if (winPrintWorker && winPrintWorker.exitCode === null) return;
  const workerPs1 = join(SCRIPT_DIR, 'win-raw-escpos-worker.ps1');
  winPrintWorker = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', workerPs1],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  winWorkerReady = false;
  winWorkerBuf = '';
  winPrintWorker.stdout.on('data', (chunk) => {
    winWorkerBuf += chunk.toString('utf8');
  });
  winPrintWorker.stderr.on('data', (c) => {
    console.warn('[fis-worker]', c.toString());
  });
  winPrintWorker.on('exit', () => {
    winPrintWorker = null;
    winWorkerReady = false;
  });
}

function takeWorkerLine(timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const nl = winWorkerBuf.indexOf('\n');
      if (nl >= 0) {
        const line = winWorkerBuf.slice(0, nl).replace(/\r$/, '').trim();
        winWorkerBuf = winWorkerBuf.slice(nl + 1);
        resolve(line);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Print worker timeout'));
        return;
      }
      setTimeout(poll, 8);
    };
    poll();
  });
}

function winRawOneShot(file, q) {
  return new Promise((resolve, reject) => {
    const ps1 = join(SCRIPT_DIR, 'win-raw-escpos.ps1');
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-PrinterName', q, '-FilePath', file],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let err = '';
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `powershell exit ${code}`));
    });
  });
}

async function winRawViaWorker(file, q) {
  ensureWinPrintWorker();
  if (!winPrintWorker?.stdin) throw new Error('Print worker not running');
  if (!winWorkerReady) {
    const ready = await takeWorkerLine(90_000);
    if (ready !== 'READY') throw new Error(ready || 'Worker failed to start');
    winWorkerReady = true;
  }
  const payload = `${JSON.stringify({ printer: q, file })}\n`;
  winPrintWorker.stdin.write(payload);
  const line = await takeWorkerLine(45_000);
  if (line === 'OK') return;
  if (line.startsWith('ERR ')) throw new Error(line.slice(4));
  throw new Error(line || 'Print worker error');
}

function winRaw(buffer, queueName) {
  const q = queueName || QUEUE;
  const file = join(tmpdir(), `lima-raw-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`);
  writeFileSync(file, buffer);
  const cleanup = () => {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  };
  const job = (async () => {
    try {
      await winRawViaWorker(file, q);
    } catch {
      await winRawOneShot(file, q);
    } finally {
      cleanup();
    }
  })();
  const scheduled = winPrintChain.then(() => job);
  winPrintChain = scheduled.catch(() => {});
  return scheduled;
}

async function sendRaw(buffer, queueName) {
  if (platform() === 'win32') return winRaw(buffer, queueName);
  if (platform() === 'darwin') return lpRaw(buffer, queueName);
  return lpRaw(buffer, queueName);
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const charset = String(process.env.ESCPOS_CHARSET || 'ascii').toLowerCase();
    const os = platform();
    const fullCheck = req.url.includes('full=1');
    const resolved =
      os === 'darwin' ? resolveDarwinQueue(QUEUE) : os === 'win32' ? resolveWin32Queue(QUEUE) : QUEUE;
    const payload = {
      ok: true,
      queue: QUEUE,
      resolvedQueue: resolved,
      platform: os,
      charset,
      escpos: 'ascii-safe',
    };
    if (os === 'win32') {
      if (fullCheck) {
        const st = win32PrinterStatus(QUEUE);
        payload.printerReady = st.ready;
        payload.printerCount = st.printers?.length ?? 0;
        if (st.printers?.length) payload.printers = st.printers;
        if (!st.ready) payload.printerError = st.error;
      } else {
        payload.printerReady = true;
        payload.printerCheck = 'quick';
      }
    }
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/print') {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    res.writeHead(400);
    res.end('invalid json');
    return;
  }

  try {
    const printer = body.printer ? String(body.printer).trim() : '';
    const os = platform();
    let queue =
      os === 'darwin'
        ? resolveDarwinQueue(printer || QUEUE)
        : os === 'win32'
          ? resolveWin32Queue(printer || QUEUE)
          : printer || QUEUE;
    if (os === 'win32') {
      queue = resolveWin32Queue(printer || QUEUE);
    }
    await sendRaw(buildEscPosReceiptBuffer(body.text ?? ''), queue);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, queue }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lima sessiz fiş: http://127.0.0.1:${PORT}/print  yazıcı="${QUEUE}"  os=${platform()}`);
  if (platform() === 'win32') {
    ensureWinPrintWorker();
    void listWin32Printers();
    console.log('Windows: hizli yazdirma worker hazirlaniyor (ilk READY bir kez).');
  }
});
