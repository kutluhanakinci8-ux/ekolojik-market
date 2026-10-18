import { sendEkolojikMail } from './emailOutboxProcessor.mjs';
import { getEffectiveMailPresentation } from './postaSettings.mjs';

export function normalizeRecoveryEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email.includes('@')) return '';
  return email;
}

/** Transactional şifre sıfırlama — From: bildirim@ (EKOLOJIK_MAIL_FROM), Reply-To: info@ */
export async function sendPasswordResetEmail(dataDir, tenantId, {
  to,
  displayName,
  username,
  resetLink,
  expiresMinutes = 60,
}) {
  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const fromLabel = pres.fromName || 'EkoPos';
  const subject = `${fromLabel} — şifre sıfırlama`;
  const name = displayName || username;
  const text = [
    `Merhaba ${name},`,
    '',
    'POS hesabınız için şifre sıfırlama talebi alındı.',
    `Bağlantı ${expiresMinutes} dakika geçerlidir:`,
    resetLink,
    '',
    'Bu talebi siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.',
    '',
    `Yardım: ${pres.replyTo || pres.opsEmail || 'info@ekolojikmarket.com.tr'}`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5;color:#1a2e1a">
      <p>Merhaba <strong>${escapeHtml(name)}</strong>,</p>
      <p>POS hesabınız (<code>${escapeHtml(username)}</code>) için şifre sıfırlama talebi alındı.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(resetLink)}" style="background:#2d6a4f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
          Yeni şifre belirle
        </a>
      </p>
      <p style="font-size:13px;color:#555">Bağlantı <strong>${expiresMinutes} dakika</strong> geçerlidir.</p>
      <p style="font-size:13px;color:#555">Talebi siz yapmadıysanız bu e-postayı yok sayın.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0"/>
      <p style="font-size:12px;color:#888">Bu mesaj ${escapeHtml(pres.from || 'bildirim@ekolojikmarket.com.tr')} adresinden otomatik gönderilmiştir.</p>
    </div>
  `.trim();

  return sendEkolojikMail(dataDir, {
    to,
    subject,
    body: text,
    html,
    fromName: fromLabel,
    source: 'password-reset',
    idempotencyKey: `password-reset:${username}:${Date.now()}`,
    tenantId,
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
