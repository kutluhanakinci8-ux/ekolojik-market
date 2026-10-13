/** Platform destek@ — otomatik alındı (HTML + düz metin) */

import { getPlatformSupportMailAddress, getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { getPlatformSupportMailBrand } from './platformSupportMailBrand.mjs';
import { supportPlusAddressForCase } from './platformSupportEmailCaseRef.mjs';

const BRAND_GREEN = '#1b4332';
const BRAND_GREEN_MID = '#2d6a4f';
const BRAND_GREEN_LIGHT = '#d8f3dc';
const FOOTER_BG = '#f3f6f4';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function socialIconLetter(key) {
  const map = { instagram: 'IG', facebook: 'f', youtube: '▶', linkedin: 'in', x: 'X' };
  return map[key] ?? '•';
}

function renderMailFooterHtml() {
  const brand = getPlatformSupportMailBrand();
  const year = new Date().getFullYear();
  const socialCells = brand.social
    .map((s) => {
      const label = escapeHtml(s.label);
      const letter = escapeHtml(socialIconLetter(s.key));
      const baseStyle = `display:inline-block;min-width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;border:1px solid #d0ddd4;font-size:13px;font-weight:700;`;
      if (s.url) {
        return `
    <td style="padding:0 6px 0 0;">
      <a href="${escapeHtml(s.url)}" title="${label}" style="${baseStyle}background:#ffffff;color:${BRAND_GREEN};text-decoration:none;">${letter}</a>
    </td>`;
      }
      return `
    <td style="padding:0 6px 0 0;">
      <span title="${label} (yakında)" style="${baseStyle}background:#f7faf8;color:#9aa89d;">${letter}</span>
    </td>`;
    })
    .join('');

  const socialRow = brand.social.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0;"><tr>
        <td style="font-size:12px;color:#5c6b60;padding-right:12px;vertical-align:middle;">Bizi takip edin</td>
        ${socialCells}
      </tr></table>`
    : '';

  return `
          <tr>
            <td style="padding:0;background:${FOOTER_BG};border-top:1px solid #e2ebe4;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:24px 32px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:56px;vertical-align:top;padding-right:14px;">
                          <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.siteName)}" width="48" height="48" style="display:block;border:0;max-width:48px;height:auto;"/>
                        </td>
                        <td style="vertical-align:top;">
                          <div style="font-size:16px;font-weight:700;color:#1a2e1a;line-height:1.3;">${escapeHtml(brand.siteName)}</div>
                          <div style="margin-top:8px;">
                            <a href="${escapeHtml(brand.contactFormUrl)}" style="font-size:14px;font-weight:600;color:${BRAND_GREEN_MID};text-decoration:underline;">Destek Al</a>
                          </div>
                          <div style="font-size:12px;color:#6b7c6f;margin-top:6px;line-height:1.5;">
                            Formu doldurarak talebinizi iletebilirsiniz.
                          </div>
                        </td>
                      </tr>
                    </table>
                    ${socialRow}
                    <p style="margin:18px 0 0;font-size:11px;line-height:1.55;color:#7a8a7e;">
                      Bu işlemi siz yapmadıysanız veya ek yardım gerekiyorsa bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.
                    </p>
                    <p style="margin:12px 0 0;font-size:11px;color:#9aa89d;">© ${year} ${escapeHtml(brand.siteName)} · <a href="${escapeHtml(brand.site)}" style="color:${BRAND_GREEN_MID};text-decoration:none;">${escapeHtml(brand.site.replace(/^https?:\/\//, ''))}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function formatCaseRefLabel(caseNumber) {
  const n = Number(caseNumber);
  return Number.isFinite(n) && n > 0 ? `#${n}` : null;
}

export function formatPlatformSupportAutoreplyText({ brandName, messageId, supportEmail, caseNumber }) {
  const brand = brandName || 'Ekolojik Destek';
  const mail = supportEmail || getPlatformSupportMailAddress();
  const siteBrand = getPlatformSupportMailBrand();
  const caseRef = formatCaseRefLabel(caseNumber);
  const lines = [
    'Merhaba,',
    '',
    `${brand} destek ekibine yazdığınız için teşekkür ederiz.`,
    'Talebiniz kayıt altına alındı; iş saatlerinde en kısa sürede size dönüş yapacağız.',
    '',
    ...(caseRef ? [`Destek kaydı: ${caseRef}`, ''] : []),
    `Talep referansı: ${messageId}`,
    ...(caseRef ? [`[EKO-DESTEK-${caseNumber}]`] : []),
    ...(caseNumber ? (() => {
      const plus = supportPlusAddressForCase(caseNumber);
      return plus ? ['', `Bu kayıt için yazışma adresi: ${plus}`] : [];
    })() : []),
    '',
    'Bu mesaja yanıt vererek yazışmaya devam edebilirsiniz.',
    '',
    `Destek formu: ${siteBrand.contactFormUrl}`,
    '',
    '— Ekolojik Destek',
    mail,
    siteBrand.site,
  ];
  if (siteBrand.social.length) {
    lines.push('', 'Sosyal medya:');
    for (const s of siteBrand.social) {
      lines.push(s.url ? `- ${s.label}: ${s.url}` : `- ${s.label}`);
    }
  }
  return lines.join('\n');
}

export function formatPlatformSupportAutoreplyHtml({ brandName, messageId, supportEmail, caseNumber }) {
  const pres = getPlatformSupportMailPresentation();
  const brand = brandName || pres.fromName || 'Ekolojik Destek';
  const mail = supportEmail || pres.from || getPlatformSupportMailAddress();
  const siteBrand = getPlatformSupportMailBrand();
  const ref = escapeHtml(messageId);
  const caseRef = formatCaseRefLabel(caseNumber);
  const caseRefHtml = caseRef
    ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2d3b2f;">Destek kaydı: <strong>${escapeHtml(caseRef)}</strong></p>`
    : '';
  const plusAddr = caseNumber ? supportPlusAddressForCase(caseNumber) : null;
  const caseTokenHtml = caseRef
    ? `<div style="font-size:11px;color:#6b7c6f;margin-top:8px;">[EKO-DESTEK-${escapeHtml(String(caseNumber))}]${
      plusAddr
        ? `<br/>Bu kayıt için: <a href="mailto:${escapeHtml(plusAddr)}" style="color:${BRAND_GREEN_MID};text-decoration:none;">${escapeHtml(plusAddr)}</a>`
        : ''
    }</div>`
    : '';

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
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Merhaba,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#2d3b2f;">
                <strong>${escapeHtml(brand)}</strong> destek ekibine yazdığınız için teşekkür ederiz.
                Talebiniz kayıt altına alındı; iş saatlerinde en kısa sürede size dönüş yapacağız.
              </p>
              ${caseRefHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${BRAND_GREEN_LIGHT};border-radius:12px;border:1px solid #b7e4c7;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND_GREEN};margin-bottom:6px;">Talep referansı</div>
                    <div style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:14px;color:#1b4332;word-break:break-all;">${ref}</div>
                    ${caseTokenHtml}
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4a5d4e;">
                Bu mesaja yanıt vererek yazışmaya devam edebilirsiniz; ekip aynı konu başlığı altında talebinizi görür.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:10px;background:${BRAND_GREEN_MID};">
                    <a href="${escapeHtml(siteBrand.contactFormUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Destek Al</a>
                  </td>
                  <td style="width:10px;"></td>
                  <td style="border-radius:10px;border:1px solid #c5d6ca;">
                    <a href="${escapeHtml(siteBrand.site)}" style="display:inline-block;padding:11px 18px;font-size:14px;font-weight:600;color:${BRAND_GREEN_MID};text-decoration:none;">Mağazayı ziyaret et</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.55;color:#6b7c6f;">
                Otomatik gönderim: <a href="mailto:${escapeHtml(mail)}" style="color:${BRAND_GREEN_MID};text-decoration:none;">${escapeHtml(mail)}</a>
              </p>
            </td>
          </tr>
          ${renderMailFooterHtml()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildPlatformSupportAutoreplyContent({ messageId, brandName, caseNumber } = {}) {
  const pres = getPlatformSupportMailPresentation();
  const brand = brandName || pres.fromName;
  const supportEmail = pres.from;
  const payload = { brandName: brand, messageId, supportEmail, caseNumber };
  return {
    text: formatPlatformSupportAutoreplyText(payload),
    html: formatPlatformSupportAutoreplyHtml(payload),
  };
}

function appendSupportMailPlainFooter(lines) {
  const siteBrand = getPlatformSupportMailBrand();
  const pres = getPlatformSupportMailPresentation();
  const mail = pres.from || getPlatformSupportMailAddress();
  lines.push('', `Destek formu: ${siteBrand.contactFormUrl}`, '', mail, siteBrand.site);
  if (siteBrand.social.length) {
    lines.push('', 'Sosyal medya:');
    for (const s of siteBrand.social) {
      lines.push(s.url ? `- ${s.label}: ${s.url}` : `- ${s.label}`);
    }
  }
  return lines;
}

function plainTextToHtmlBlocks(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, '<br/>');
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#2d3b2f;">${inner}</p>`;
    })
    .join('');
}

function platformSupportMailShell({ title, headerTitle, headerSubtitle, mainRowsHtml }) {
  const brandTitle = escapeHtml(headerTitle);
  const subtitle = escapeHtml(headerSubtitle);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${escapeHtml(title)}</title>
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
                    <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.25;">${brandTitle}</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:8px;">${subtitle}</div>
                  </td>
                  <td align="right" style="vertical-align:middle;width:48px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);text-align:center;line-height:44px;font-size:22px;">🌿</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${mainRowsHtml}
          ${renderMailFooterHtml()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function formatPlatformSupportOperatorReplyText({ body, operatorUsername }) {
  const signedBy = operatorUsername || 'Ekolojik Platform';
  const lines = [String(body ?? '').trim(), '', `— ${signedBy}`];
  return appendSupportMailPlainFooter(lines).join('\n');
}

export function formatPlatformSupportOperatorReplyHtml({ body, operatorUsername }) {
  const pres = getPlatformSupportMailPresentation();
  const brand = pres.fromName || 'Ekolojik Destek';
  const signedBy = escapeHtml(operatorUsername || 'Ekolojik Platform');
  const bodyHtml = plainTextToHtmlBlocks(body);
  const mainRowsHtml = `
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyHtml || '<p style="margin:0;font-size:15px;line-height:1.65;color:#2d3b2f;">&nbsp;</p>'}
              <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a5d4e;">— ${signedBy}</p>
            </td>
          </tr>`;
  return platformSupportMailShell({
    title: 'Destek yanıtı',
    headerTitle: brand,
    headerSubtitle: 'Yardım merkezi · Destek yanıtı',
    mainRowsHtml,
  });
}

export function buildPlatformSupportOperatorReplyContent({ body, operatorUsername } = {}) {
  const payload = { body, operatorUsername };
  return {
    text: formatPlatformSupportOperatorReplyText(payload),
    html: formatPlatformSupportOperatorReplyHtml(payload),
  };
}
