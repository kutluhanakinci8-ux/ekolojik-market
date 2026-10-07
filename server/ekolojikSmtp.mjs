import nodemailer from 'nodemailer';
import {
  buildFromHeader,
  getEkolojikMailConfig,
  isEkolojikSmtpConfigured,
} from './ekolojikMailConfig.mjs';

let transporter;
let transporterKey = '';

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

function getTransporter() {
  if (!isEkolojikSmtpConfigured()) {
    throw new Error('EKOLOJIK_SMTP_HOST ve EKOLOJIK_MAIL_FROM yapılandırılmalı');
  }
  const c = getEkolojikMailConfig();
  const key = `${c.smtpHost}:${c.smtpPort}:${c.smtpSecure}:${c.smtpUser || ''}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport(buildTransportOptions(c));
    transporterKey = key;
  }
  return transporter;
}

export async function verifyEkolojikSmtp() {
  if (!isEkolojikSmtpConfigured()) {
    return { ok: false, error: 'SMTP yapılandırılmadı' };
  }
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'SMTP doğrulama hatası',
    };
  }
}

export async function sendViaEkolojikSmtp({
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
  const c = getEkolojikMailConfig();
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

  const info = await getTransporter().sendMail({
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

export { isEkolojikSmtpConfigured };
