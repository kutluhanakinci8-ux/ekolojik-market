import nodemailer from 'nodemailer';
import {
  buildFromHeader,
  getEkolojikMailConfig,
  isEkolojikSmtpConfigured,
} from './ekolojikMailConfig.mjs';
import { getTenantSmtpMailConfig, isTenantSmtpConfigured } from './tenantMailConfig.mjs';

const transporterCache = new Map();

function isLocalSmtpRelay(c) {
  const h = (c.smtpHost || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function buildTransportOptions(c) {
  const local = isLocalSmtpRelay(c);
  const opts = {
    host: c.smtpHost,
    port: c.smtpPort,
    secure: local ? false : c.smtpSecure,
    auth: c.smtpUser
      ? {
          user: c.smtpUser,
          pass: c.smtpPass,
        }
      : undefined,
  };
  if (local) {
    opts.ignoreTLS = c.smtpPort === 25;
    opts.tls = { rejectUnauthorized: false };
  }
  return opts;
}

export function isSmtpMailConfigValid(c) {
  return Boolean(c?.smtpHost && c?.from && String(c.from).includes('@'));
}

function transporterCacheKey(c) {
  return `${c.smtpHost}:${c.smtpPort}:${c.smtpSecure}:${c.smtpUser || ''}`;
}

function getTransporterForConfig(c) {
  if (!isSmtpMailConfigValid(c)) {
    throw new Error('SMTP host ve geçerli From adresi gerekli');
  }
  const key = transporterCacheKey(c);
  let transporter = transporterCache.get(key);
  if (!transporter) {
    transporter = nodemailer.createTransport(buildTransportOptions(c));
    transporterCache.set(key, transporter);
  }
  return transporter;
}

async function resolveMailConfig(dataDir, tenantId = 'main') {
  if (dataDir) {
    return getTenantSmtpMailConfig(dataDir, tenantId);
  }
  return getEkolojikMailConfig();
}

export async function verifyEkolojikSmtp({ dataDir, tenantId = 'main' } = {}) {
  const configured = dataDir ? await isTenantSmtpConfigured(dataDir, tenantId) : isEkolojikSmtpConfigured();
  if (!configured) {
    return { ok: false, error: 'SMTP yapılandırılmadı' };
  }
  try {
    const c = await resolveMailConfig(dataDir, tenantId);
    await getTransporterForConfig(c).verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'SMTP doğrulama hatası',
    };
  }
}

export async function sendViaEkolojikSmtp({
  dataDir,
  tenantId = 'main',
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  fromName,
  replyTo,
  inReplyTo,
  references,
  attachments,
}) {
  const c = await resolveMailConfig(dataDir, tenantId);
  const from = buildFromHeader(fromName || c.fromName, c.from);
  const reply = replyTo?.includes('@') ? replyTo : c.replyTo || undefined;
  const headers = {};
  if (inReplyTo?.includes('@') || inReplyTo?.startsWith('<')) headers['In-Reply-To'] = inReplyTo;
  if (references?.trim()) headers.References = references.trim();
  const mailAttachments = (attachments ?? [])
    .filter((a) => a?.dataBase64)
    .map((a) => ({
      filename: a.fileName || 'ek',
      content: Buffer.from(String(a.dataBase64).replace(/\s/g, ''), 'base64'),
      contentType: a.mimeType || undefined,
    }));

  const info = await getTransporterForConfig(c).sendMail({
    from,
    to,
    cc: cc?.trim() || undefined,
    bcc: bcc?.trim() || undefined,
    replyTo: reply,
    subject,
    text: text || subject,
    html: html || undefined,
    headers: Object.keys(headers).length ? headers : undefined,
    attachments: mailAttachments.length ? mailAttachments : undefined,
  });
  return {
    messageId: info.messageId,
    accepted: info.accepted,
  };
}

export { isEkolojikSmtpConfigured, isTenantSmtpConfigured };
