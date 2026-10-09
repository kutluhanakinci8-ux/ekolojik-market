#!/usr/bin/env node
/**
 * Lima Mac — POS-80C ham ESC/POS (CUPS rastertopos / c0 çöpü YOK)
 * Kullanım: node scripts/lima-mac-raw-print.mjs
 * Lima fişi önce http://127.0.0.1:18765/print dener.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.LIMA_RAW_PRINT_PORT || 18765);
const QUEUE = process.env.POS80_QUEUE_NAME || 'Printer_POS_80C';

function escposPayload(text) {
  const init = Buffer.from([0x1b, 0x40]);
  const body = Buffer.from(String(text).replace(/\r\n/g, '\n') + '\n\n', 'utf8');
  const cut = Buffer.from([0x1d, 0x56, 0x00]);
  return Buffer.concat([init, body, cut]);
}

function lpRaw(buffer) {
  return new Promise((resolve, reject) => {
    const file = join(tmpdir(), `lima-raw-${Date.now()}.bin`);
    writeFileSync(file, buffer);
    const child = spawn('lp', ['-d', QUEUE, '-o', 'raw', file], { stdio: ['ignore', 'pipe', 'pipe'] });
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
    res.end(JSON.stringify({ ok: true, queue: QUEUE }));
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
    await lpRaw(escposPayload(body.text ?? ''));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lima ham fiş: http://127.0.0.1:${PORT}/print  kuyruk=${QUEUE}`);
  console.log('Test: curl -s -X POST http://127.0.0.1:18765/print -d \'{"text":"LIMA TEST"}\'');
});
