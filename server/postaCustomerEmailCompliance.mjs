import { isClickTrackEnabled } from './postaEngagement.mjs';
import { isMailTrackEnabled } from './postaMailTrack.mjs';
import { getPostaMailSettings } from './postaSettings.mjs';

export const DEFAULT_CUSTOMER_TRACKING_NOTICE =
  'Bu ileti, hizmet kalitesi ve iletişim süreçlerinin iyileştirilmesi amacıyla istatistiksel açılma/tıklama ölçümü içerebilir (KVKK m.5/6). Ayrıntılar için gizlilik politikamıza bakın.';

export function isCustomerEmailTrackingActive() {
  return isMailTrackEnabled() || isClickTrackEnabled();
}

export async function getCustomerEmailTrackingNotice(dataDir, tenantId = 'main') {
  const settings = await getPostaMailSettings(dataDir, tenantId);
  if (settings.customerTrackingNoticeEnabled === false) {
    return { enabled: false, text: '' };
  }
  const text = String(settings.customerTrackingNoticeText ?? '').trim() || DEFAULT_CUSTOMER_TRACKING_NOTICE;
  return { enabled: isCustomerEmailTrackingActive(), text };
}

export async function appendCustomerTrackingNotice(dataDir, tenantId, { text, html }) {
  const notice = await getCustomerEmailTrackingNotice(dataDir, tenantId);
  if (!notice.enabled || !notice.text) {
    return { text, html };
  }
  const footer = `\n\n—\n${notice.text}`;
  const nextText = text?.trim() ? `${text}${footer}` : notice.text;
  const htmlFooter = `<p style="font-size:11px;color:#666;margin-top:16px">${notice.text.replace(/\n/g, '<br/>')}</p>`;
  const nextHtml = html?.trim()
    ? html.includes('</body>')
      ? html.replace(/<\/body>/i, `${htmlFooter}</body>`)
      : `${html}${htmlFooter}`
    : `<div>${htmlFooter}</div>`;
  return { text: nextText, html: nextHtml };
}
