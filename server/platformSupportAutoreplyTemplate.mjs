/** Platform destek@ — otomatik alındı (HTML + düz metin) */

import { getPlatformSupportMailAddress, getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';

const BRAND_GREEN = '#1b4332';
const BRAND_GREEN_MID = '#2d6a4f';
const BRAND_GREEN_LIGHT = '#d8f3dc';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function publicSiteUrl() {
  return (
    process.env.EKOLOJIK_PUBLIC_BASE_URL?.trim()
    || process.env.EKOLOJIK_PUBLIC_URL?.trim()
    || 'https://www.ekolojikmarket.com.tr'
  ).replace(/\/$/, '');
}

export function formatPlatformSupportAutoreplyText({ brandName, messageId, supportEmail }) {
  const brand = brandName || 'Ekolojik Destek';
  const mail = supportEmail || getPlatformSupportMailAddress();
  return [
    'Merhaba,',
    '',
    `${brand} destek ekibine yazdığınız için teşekkür ederiz.`,
    'Talebiniz kayıt altına alındı; iş saatlerinde en kısa sürede size dönüş yapacağız.',
    '',
    `Talep referansı: ${messageId}`,
    '',
    'Bu e-posta otomatik gönderilmiştir. Yanıtınız destek ekibimize ulaşır.',
    '',
    '— Ekolojik Destek',
    mail,
    publicSiteUrl(),
  ].join('\n');
}

export function formatPlatformSupportAutoreplyHtml({ brandName, messageId, supportEmail }) {
  const pres = getPlatformSupportMailPresentation();
  const brand = brandName || pres.fromName || 'Ekolojik Destek';
  const mail = supportEmail || pres.from || getPlatformSupportMailAddress();
  const site = publicSiteUrl();
  const ref = escapeHtml(messageId);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>Talebiniz alındı</title>
</head>
<body style="margin:0;padding:0;background:#eef2ef;font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;color:#1a2e1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ef;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d8e2dc;box-shadow:0 12px 40px rgba(27,67,50,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_GREEN} 0%,${BRAND_GREEN_MID} 100%);padding:28px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);margin-bottom:6px;">Ekolojik Platform</div>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.25;">${escapeHtml(brand)}</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:8px;">Yardım merkezi · Talep alındı bildirimi</div>
                  </td>
                  <td align="right" style="vertical-align:middle;width:48px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);text-align:center;line-height:44px;font-size:22px;">🌿</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Merhaba,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#2d3b2f;">
                <strong>${escapeHtml(brand)}</strong> destek ekibine yazdığınız için teşekkür ederiz.
                Talebiniz kayıt altına alındı; iş saatlerinde en kısa sürede size dönüş yapacağız.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${BRAND_GREEN_LIGHT};border-radius:12px;border:1px solid #b7e4c7;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND_GREEN};margin-bottom:6px;">Talep referansı</div>
                    <div style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:14px;color:#1b4332;word-break:break-all;">${ref}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a5d4e;">
                Bu mesaja yanıt vererek yazışmaya devam edebilirsiniz; ekip aynı konu başlığı altında talebinizi görür.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:10px;background:${BRAND_GREEN_MID};">
                    <a href="${escapeHtml(site)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Ekolojik Market</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <hr style="border:none;border-top:1px solid #e8efe9;margin:20px 0 16px;"/>
              <p style="margin:0;font-size:12px;line-height:1.55;color:#6b7c6f;">
                Bu e-posta <a href="mailto:${escapeHtml(mail)}" style="color:${BRAND_GREEN_MID};text-decoration:none;">${escapeHtml(mail)}</a>
                adresinden otomatik gönderilmiştir.
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#9aa89d;">© ${year} Ekolojik Market · Tüm hakları saklıdır.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildPlatformSupportAutoreplyContent({ messageId, brandName } = {}) {
  const pres = getPlatformSupportMailPresentation();
  const brand = brandName || pres.fromName;
  const supportEmail = pres.from;
  const payload = { brandName: brand, messageId, supportEmail };
  return {
    text: formatPlatformSupportAutoreplyText(payload),
    html: formatPlatformSupportAutoreplyHtml(payload),
  };
}
