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
  (platform() === 'win32' ? 'Printer POS-80C' : 'Printer_POS_80C');

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function winRaw(buffer, queueName) {
  const q = queueName || QUEUE;
  return new Promise((resolve, reject) => {
    const file = join(tmpdir(), `lima-raw-${Date.now()}.bin`);
    writeFileSync(file, buffer);
    const ps1 = join(REPO_ROOT, 'scripts', 'win-raw-escpos.ps1');
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-PrinterName', q, '-FilePath', file],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
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
      else reject(new Error(err || `powershell exit ${code}`));
    });
  });
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

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const charset = String(process.env.ESCPOS_CHARSET || 'ascii').toLowerCase();
    res.end(
      JSON.stringify({
        ok: true,
        queue: QUEUE,
        platform: platform(),
        charset,
        escpos: 'ascii-safe',
      }),
    );
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
    const queue =
      platform() === 'darwin'
        ? resolveDarwinQueue(printer || QUEUE)
        : printer || QUEUE;
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
  console.log('Bu pencere açık kalsın; satışta tarayıcı yazdır diyaloğu açılmaz.');
});
