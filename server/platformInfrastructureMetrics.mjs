/** Platform — altyapı, posta, outbox, yedek ve izolasyon özeti */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getEkolojikIsolationReport } from './ekolojikIsolationCheck.mjs';
import { getOutboxCounts, getOutboxCountsByTenant } from './emailOutbox.mjs';
import {
  getEkolojikMailConfig,
  getEkolojikImapConfig,
  isEkolojikImapConfigured,
  isEkolojikSmtpConfigured,
  getEkolojikOpsEmail,
  getEkolojikSmtpHostHint,
} from './ekolojikMailConfig.mjs';
import { isLertaPlatformConfigured } from './lertaPlatformBridge.mjs';

const execFileAsync = promisify(execFile);

function retentionDays(envKey, fallback) {
  const n = Number(process.env[envKey]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function dirSizeBytes(absPath) {
  try {
    const { stdout } = await execFileAsync('du', ['-sk', absPath]);
    const kb = Number(String(stdout).trim().split(/\s+/)[0]);
    return Number.isFinite(kb) ? kb * 1024 : null;
  } catch {
    return null;
  }
}

async function readPackageVersion() {
  try {
    const raw = JSON.parse(await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    return String(raw.version ?? '0.0.0');
  } catch {
    return 'unknown';
  }
}

async function latestBackupInfo() {
  const root =
    process.env.EKOLOJIK_BACKUP_DIR?.trim() || '/var/backups/ekolojik-market';
  try {
    const names = await readdir(root);
    const archives = [];
    for (const name of names) {
      if (!name.endsWith('.tar.gz')) continue;
      const full = join(root, name);
      const st = await stat(full);
      archives.push({ name, path: full, mtimeMs: st.mtimeMs, sizeBytes: st.size });
    }
    archives.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = archives[0];
    if (!latest) {
      return { backupRoot: root, latest: null, count: 0 };
    }
    return {
      backupRoot: root,
      count: archives.length,
      latest: {
        name: latest.name,
        at: new Date(latest.mtimeMs).toISOString(),
        sizeBytes: latest.sizeBytes,
      },
    };
  } catch {
    return { backupRoot: root, latest: null, count: 0, unreadable: true };
  }
}

async function readCronSnippets() {
  const paths = [
    '/etc/cron.d/ekolojik-outbox-failed-archive',
    '/etc/cron.d/ekolojik-data-yedek',
    '/etc/cron.d/ekolojik-support-inbox-sync',
  ];
  const jobs = [];
  for (const path of paths) {
    try {
      const raw = await readFile(path, 'utf8');
      const lines = raw.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      jobs.push({ id: path.split('/').pop(), path, installed: true, sample: lines[0]?.slice(0, 120) ?? '' });
    } catch {
      jobs.push({ id: path.split('/').pop(), path, installed: false, sample: '' });
    }
  }
  return jobs;
}

function computeInfraScore(checks, outboxFailed) {
  let score = 100;
  for (const c of checks) {
    if (c.ok) continue;
    if (c.id === 'outbox_failed') score -= Math.min(25, outboxFailed * 2);
    else if (c.id === 'lerta_bridge_off') score -= 15;
    else score -= 8;
  }
  return Math.max(0, Math.min(100, score));
}

export async function runInfrastructureProbes(dataDir, { smtp = true, imap = true } = {}) {
  const probes = { smtp: null, imap: null };
  if (smtp && isEkolojikSmtpConfigured()) {
    try {
      const { verifyEkolojikSmtp } = await import('./ekolojikSmtp.mjs');
      const result = await verifyEkolojikSmtp({ dataDir, tenantId: 'main' });
      probes.smtp = { ok: result.ok, error: result.error ?? null };
    } catch (error) {
      probes.smtp = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  } else if (smtp) {
    probes.smtp = { ok: false, error: 'SMTP yapılandırılmadı' };
  }
  if (imap && isEkolojikImapConfigured()) {
    try {
      const { verifyImapMailbox } = await import('./billEmailImap.mjs');
      const cfg = getEkolojikImapConfig();
      const result = await verifyImapMailbox({
        imapHost: cfg.imapHost,
        imapPort: cfg.imapPort,
        imapSecure: cfg.imapSecure,
        imapUser: cfg.imapUser,
        imapPassword: cfg.imapPassword,
        inboxAddress: cfg.inboxAddress,
      });
      probes.imap = {
        ok: result.ok,
        message: result.message ?? null,
        mailboxCount: result.mailboxCount ?? null,
        unseenCount: result.unseenCount ?? null,
      };
    } catch (error) {
      probes.imap = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  } else if (imap) {
    probes.imap = { ok: false, error: 'IMAP yapılandırılmadı' };
  }
  return { ok: true, probes };
}

export async function buildPlatformInfrastructureOverview(dataDir) {
  const isolation = await getEkolojikIsolationReport(dataDir);
  const [counts, countsByTenant, appVersion, backup, cronJobs] = await Promise.all([
    getOutboxCounts(dataDir),
    getOutboxCountsByTenant(dataDir),
    readPackageVersion(),
    latestBackupInfo(),
    readCronSnippets(),
  ]);

  const dataPaths = [
    'email-outbox',
    'messaging',
    'posta-inbox',
    'posta-track',
    'tenants',
    'platform',
  ];
  const storage = [];
  for (const name of dataPaths) {
    const abs = join(dataDir, name);
    const bytes = await dirSizeBytes(abs);
    storage.push({ name, path: `data/${name}`, sizeBytes: bytes });
  }

  const mailCfg = getEkolojikMailConfig();
  const imapCfg = getEkolojikImapConfig();
  const score = computeInfraScore(isolation.checks, counts.failed ?? 0);

  const { readPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');

  return {
    generatedAt: new Date().toISOString(),
    score,
    runtime: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      port: Number(process.env.PORT || 5180),
      uptimeSec: Math.floor(process.uptime()),
      dataDir,
      appVersion,
      deployRef: process.env.GITHUB_SHA?.slice(0, 7) ?? process.env.CURSOR_COMMIT_SHA?.slice(0, 7) ?? null,
      platformSessionEpoch: await readPlatformSessionEpoch(dataDir),
    },
    mail: {
      smtpConfigured: isEkolojikSmtpConfigured(),
      smtpHost: mailCfg.smtpHost || null,
      smtpPort: mailCfg.smtpPort,
      from: mailCfg.from || null,
      opsEmail: getEkolojikOpsEmail() || null,
      smtpHostHint: getEkolojikSmtpHostHint(),
      imapConfigured: isEkolojikImapConfigured(),
      imapHost: imapCfg.imapHost || null,
      imapUser: imapCfg.imapUser || null,
      lertaBridge: isLertaPlatformConfigured(),
    },
    outbox: {
      counts,
      byTenant: countsByTenant.sort((a, b) => b.failed * 10 + b.pending - (a.failed * 10 + a.pending)),
      failedAlertThreshold: Number(process.env.EKOLOJIK_OUTBOX_FAILED_ALERT_THRESHOLD || 50),
    },
    isolation: {
      ok: isolation.ok,
      checks: isolation.checks,
      dataPaths: isolation.dataPaths,
      envHints: isolation.envHints,
    },
    storage,
    backup,
    cronJobs,
    retention: {
      outboxDays: retentionDays('EKOLOJIK_OUTBOX_RETENTION_DAYS', 90),
      messagingDays: retentionDays('EKOLOJIK_MESSAGING_RETENTION_DAYS', 365),
      contactDays: retentionDays('EKOLOJIK_CONTACT_RETENTION_DAYS', 730),
    },
  };
}
