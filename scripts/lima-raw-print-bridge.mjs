#!/usr/bin/env node
/**
 * Lima — sessiz termal fiş (tarayıcı yazdır penceresi YOK)
 * Mac: lp -o raw | Windows: win-raw-escpos.ps1 → POS-80C
 *
 *   node scripts/lima-raw-print-bridge.mjs
 *   set POS80_QUEUE_NAME=Printer POS-80C   (Windows, Ayarlar’daki tam ad)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.LIMA_RAW_PRINT_PORT || 18765);
const QUEUE =
  process.env.POS80_QUEUE_NAME ||
  (platform() === 'win32' ? 'Printer POS-80C' : 'Printer_POS_80C');

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function escposPayload(text) {
  const init = Buffer.from([0x1b, 0x40]);
  const body = Buffer.from(String(text).replace(/\r\n/g, '\n') + '\n\n', 'utf8');
  const cut = Buffer.from([0x1d, 0x56, 0x00]);
  return Buffer.concat([init, body, cut]);
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
    res.end(JSON.stringify({ ok: true, queue: QUEUE, platform: platform() }));
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
    await sendRaw(escposPayload(body.text ?? ''), printer || QUEUE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, queue: printer || QUEUE }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lima sessiz fiş: http://127.0.0.1:${PORT}/print  yazıcı="${QUEUE}"  os=${platform()}`);
  console.log('Bu pencere açık kalsın; satışta tarayıcı yazdır diyaloğu açılmaz.');
});
