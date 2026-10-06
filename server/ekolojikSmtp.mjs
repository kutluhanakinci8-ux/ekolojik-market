import nodemailer from 'nodemailer';
import {
  buildFromHeader,
  getEkolojikMailConfig,
  isEkolojikSmtpConfigured,
} from './ekolojikMailConfig.mjs';

let transporter;

function getTransporter() {
  if (!isEkolojikSmtpConfigured()) {
    throw new Error('EKOLOJIK_SMTP_HOST ve EKOLOJIK_MAIL_FROM yapılandırılmalı');
  }
  if (!transporter) {
    const c = getEkolojikMailConfig();
    transporter = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpSecure,
      auth: c.smtpUser
        ? {
            user: c.smtpUser,
            pass: c.smtpPass,
          }
        : undefined,
    });
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

export async function sendViaEkolojikSmtp({ to, subject, text, html, fromName, replyTo }) {
  const c = getEkolojikMailConfig();
  const from = buildFromHeader(fromName || c.fromName, c.from);
  const reply = replyTo?.includes('@') ? replyTo : c.replyTo || undefined;
  const info = await getTransporter().sendMail({
    from,
    to,
    replyTo: reply,
    subject,
    text: text || subject,
    html: html || undefined,
  });
  return {
    messageId: info.messageId,
    accepted: info.accepted,
  };
}

export { isEkolojikSmtpConfigured };
