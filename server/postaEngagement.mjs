import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isMailTrackEnabled } from './postaMailTrack.mjs';

function trackDir(dataDir) {
  return join(dataDir, 'posta-track');
}

function opensPath(dataDir) {
  return join(trackDir(dataDir), 'opens.jsonl');
}

function clicksPath(dataDir) {
  return join(trackDir(dataDir), 'clicks.jsonl');
}

function bouncesPath(dataDir) {
  return join(trackDir(dataDir), 'bounces.jsonl');
}

async function appendRow(dataDir, filename, row) {
  await mkdir(trackDir(dataDir), { recursive: true });
  await appendFile(join(trackDir(dataDir), filename), `${JSON.stringify(row)}\n`, 'utf8');
}

export function isClickTrackEnabled() {
  return isMailTrackEnabled() || String(process.env.EKOLOJIK_MAIL_CLICK_TRACK ?? '').trim() === '1';
}

export function engagementWebhookConfigured() {
  return Boolean(process.env.EKOLOJIK_POSTA_ENGAGEMENT_WEBHOOK?.trim());
}

export async function fireEngagementWebhook(event, payload) {
  const url = process.env.EKOLOJIK_POSTA_ENGAGEMENT_WEBHOOK?.trim();
  if (!url) return { skipped: true };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ekolojik-posta',
        event,
        at: new Date().toISOString(),
        ...payload,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function wrapHtmlLinksForClickTracking(html, trackToken, baseUrl) {
  if (!isClickTrackEnabled() || !trackToken?.trim() || !html?.trim()) return html;
  const base = String(baseUrl ?? '').replace(/\/$/, '');
  if (!base) return html;
  return String(html).replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_m, quote, url) => {
    const encoded = Buffer.from(url, 'utf8').toString('base64url');
    const tracked = `${base}/api/posta/track/click/${trackToken}?u=${encoded}`;
    return `href=${quote}${tracked}${quote}`;
  });
}

export async function recordMailClick(dataDir, token, { url, ip, tenantId } = {}) {
  if (!token?.trim()) return { ok: false };
  const row = {
    token,
    url: url ?? null,
    at: new Date().toISOString(),
    ip: ip ?? null,
    tenantId: tenantId ? safeTenantId(tenantId) : undefined,
  };
  await appendRow(dataDir, 'clicks.jsonl', row);
  await fireEngagementWebhook('click', row);
  return { ok: true };
}

export async function recordEngagementBounce(dataDir, payload) {
  const row = {
    outboxId: payload.outboxId ?? null,
    to: payload.to ?? null,
    subject: payload.subject ?? null,
    error: payload.error ?? null,
    source: payload.source ?? null,
    tenantId: payload.tenantId ? safeTenantId(payload.tenantId) : 'main',
    at: new Date().toISOString(),
  };
  await appendRow(dataDir, 'bounces.jsonl', row);
  await fireEngagementWebhook('bounce', row);
  return { ok: true };
}

export async function notifyEngagementOpen(dataDir, token, meta) {
  await fireEngagementWebhook('open', { token, ...meta });
}

async function readJsonlFile(path, limit = 5000) {
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function inWindow(row, sinceMs) {
  const t = Date.parse(row.at ?? '');
  return Number.isFinite(t) && t >= sinceMs;
}

function safeTenantId(tenantId) {
  const raw = String(tenantId || 'main').trim() || 'main';
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function matchesTenant(row, tenantId) {
  const want = safeTenantId(tenantId);
  const got = row.tenantId ? safeTenantId(row.tenantId) : 'main';
  return got === want;
}

export async function getPostaEngagementSummary(dataDir, { days = 14, tenantId = 'main' } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const since = Date.now() - windowDays * 86400000;

  const opens = (await readJsonlFile(opensPath(dataDir)))
    .filter((r) => inWindow(r, since))
    .filter((r) => matchesTenant(r, tenantId));
  const clicks = (await readJsonlFile(clicksPath(dataDir)))
    .filter((r) => inWindow(r, since))
    .filter((r) => matchesTenant(r, tenantId));
  const bounces = (await readJsonlFile(bouncesPath(dataDir)))
    .filter((r) => inWindow(r, since))
    .filter((r) => matchesTenant(r, tenantId));

  const uniqueOpenTokens = new Set(opens.map((r) => r.token).filter(Boolean));
  const uniqueClickTokens = new Set(clicks.map((r) => r.token).filter(Boolean));

  return {
    ok: true,
    tenantId: safeTenantId(tenantId),
    windowDays,
    mailTrackEnabled: isMailTrackEnabled(),
    clickTrackEnabled: isClickTrackEnabled(),
    webhookConfigured: engagementWebhookConfigured(),
    counts: {
      opens: opens.length,
      uniqueOpens: uniqueOpenTokens.size,
      clicks: clicks.length,
      uniqueClicks: uniqueClickTokens.size,
      bounces: bounces.length,
    },
    recent: {
      opens: opens.slice(-5).reverse(),
      clicks: clicks.slice(-5).reverse(),
      bounces: bounces.slice(-5).reverse(),
    },
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildPostaEngagementCsv(dataDir, { type = 'combined', days = 90, tenantId = 'main' } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 90, 1), 365);
  const since = Date.now() - windowDays * 86400000;
  const filter = (rows) =>
    rows.filter((r) => inWindow(r, since)).filter((r) => matchesTenant(r, tenantId));

  const opens = filter(await readJsonlFile(opensPath(dataDir), 10000));
  const clicks = filter(await readJsonlFile(clicksPath(dataDir), 10000));
  const bounces = filter(await readJsonlFile(bouncesPath(dataDir), 10000));

  const lines = ['type,at,tenantId,token,outboxId,to,subject,url,error,ip'];

  if (type === 'opens' || type === 'combined') {
    for (const r of opens) {
      lines.push(
        ['open', r.at, r.tenantId ?? 'main', r.token, '', '', '', '', r.ip]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  if (type === 'clicks' || type === 'combined') {
    for (const r of clicks) {
      lines.push(
        ['click', r.at, r.tenantId ?? 'main', r.token, '', '', '', r.url, '', r.ip]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  if (type === 'bounces' || type === 'combined') {
    for (const r of bounces) {
      lines.push(
        ['bounce', r.at, r.tenantId ?? 'main', '', r.outboxId, r.to, r.subject, '', r.error, '']
          .map(csvEscape)
          .join(','),
      );
    }
  }

  return { ok: true, csv: `${lines.join('\n')}\n`, rowCount: lines.length - 1 };
}
