import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { listRecentOutbox } from './emailOutbox.mjs';
import { listContactMessages } from './tenantAuth.mjs';
import { listMessagingThreads, listMessagingMessages } from './messaging/store.mjs';

const execFileAsync = promisify(execFile);

function csvEscape(value) {
  const s = String(value ?? '').replace(/\r/g, ' ').replace(/\n/g, ' ');
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function inRange(iso, fromDate, toDate) {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return false;
  if (fromDate && t < fromDate.getTime()) return false;
  if (toDate && t > toDate.getTime()) return false;
  return true;
}

function parseRange(fromStr, toStr) {
  const fromDate = fromStr ? new Date(fromStr) : null;
  const toDate = toStr ? new Date(toStr) : null;
  if (fromDate && !Number.isFinite(fromDate.getTime())) return { error: 'Geçersiz from tarihi' };
  if (toDate && !Number.isFinite(toDate.getTime())) return { error: 'Geçersiz to tarihi' };
  if (toDate) toDate.setHours(23, 59, 59, 999);
  return { fromDate, toDate };
}

export async function buildOutboxCsv(dataDir, { from, to } = {}) {
  const { fromDate, toDate, error } = parseRange(from, to);
  if (error) return { ok: false, error };
  const { pending, sent, failed } = await listRecentOutbox(dataDir, 2000);
  const rows = [...pending, ...sent, ...failed].filter((m) =>
    inRange(m.sentAt || m.createdAt, fromDate, toDate),
  );
  const lines = [
    'tarih;durum;alici;konu;kaynak;hata',
    ...rows.map((m) =>
      [
        csvEscape(m.sentAt || m.createdAt),
        csvEscape(m.status ?? m.folder),
        csvEscape(m.to),
        csvEscape(m.subject),
        csvEscape(m.source),
        csvEscape(m.lastError),
      ].join(';'),
    ),
  ];
  return { ok: true, csv: lines.join('\n'), count: rows.length };
}

export async function buildContactCsv(dataDir, { from, to } = {}) {
  const { fromDate, toDate, error } = parseRange(from, to);
  if (error) return { ok: false, error };
  const items = await listContactMessages(dataDir, 500);
  const rows = items.filter((m) => inRange(m.createdAt, fromDate, toDate));
  const lines = [
    'tarih;ad;email;konu;mesaj',
    ...rows.map((m) =>
      [
        csvEscape(m.createdAt),
        csvEscape(m.name),
        csvEscape(m.email),
        csvEscape(m.subject),
        csvEscape(m.message),
      ].join(';'),
    ),
  ];
  return { ok: true, csv: lines.join('\n'), count: rows.length };
}

export async function buildMessagingExportZip(dataDir, tenantId = 'main') {
  const tmpRoot = join(dataDir, '.export-tmp', `messaging-${Date.now()}`);
  await mkdir(tmpRoot, { recursive: true });
  const threadsResult = await listMessagingThreads(dataDir, tenantId, { limit: 200 });
  const threads = threadsResult.threads ?? [];
  await writeFile(join(tmpRoot, 'threads.json'), JSON.stringify(threads, null, 2), 'utf8');

  const messagesDir = join(tmpRoot, 'messages');
  await mkdir(messagesDir, { recursive: true });
  for (const thread of threads) {
    const msgResult = await listMessagingMessages(dataDir, tenantId, thread.id, { limit: 500 });
    await writeFile(
      join(messagesDir, `${thread.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`),
      JSON.stringify(msgResult.messages ?? [], null, 2),
      'utf8',
    );
  }

  const zipPath = join(tmpRoot, 'ekolojik-messaging-export.zip');
  try {
    await execFileAsync('zip', ['-qr', zipPath, '.'], { cwd: tmpRoot });
    const zip = await readFile(zipPath);
    await rm(tmpRoot, { recursive: true, force: true });
    return { ok: true, buffer: zip, filename: 'ekolojik-messaging-export.zip' };
  } catch {
    const bundle = {
      exportedAt: new Date().toISOString(),
      tenantId,
      threads,
    };
    for (const thread of threads) {
      const msgResult = await listMessagingMessages(dataDir, tenantId, thread.id, { limit: 500 });
      bundle[`messages_${thread.id}`] = msgResult.messages ?? [];
    }
    await rm(tmpRoot, { recursive: true, force: true });
    const json = Buffer.from(JSON.stringify(bundle, null, 2), 'utf8');
    return { ok: true, buffer: json, filename: 'ekolojik-messaging-export.json', fallback: true };
  }
}
