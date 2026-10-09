import type { CartItem, PriceType, Product, Sale } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { SaleReturn } from '../types/saleReturn';
import type { ThermalReceiptPrintOptions } from '../types/receiptPrinter';
import { normalizeReceiptPrinterSettings } from '../types/receiptPrinter';
import { logReceiptPrint } from './receiptPrintLog';
import { remindChromeReceiptPrintSettings } from './receiptPrintReminder';

const BLANK_PRINT_TITLE = '\u200b';

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SaleReceiptData {
  businessName: string;
  receiptNo?: string;
  saleId?: string;
  createdAt: Date;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit';
  items: ReceiptLineItem[];
  total: number;
}

export interface ReturnReceiptLineItem extends ReceiptLineItem {
  priceType?: PriceType;
}

export interface ReturnReceiptData {
  businessName: string;
  returnId: string;
  originalSaleId: string;
  originalSaleDate?: Date;
  createdAt: Date;
  refundMethod: 'cash' | 'card' | 'transfer' | 'credit';
  items: ReturnReceiptLineItem[];
  refundTotal: number;
  reason?: string;
  note?: string;
  cashierName?: string;
}

const PAYMENT_LABELS: Record<SaleReceiptData['paymentMethod'], string> = {
  cash: 'Nakit',
  card: 'Kredi Kartı',
  transfer: 'Havale/EFT',
  credit: 'Veresiye',
};

function formatReceiptMoney(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Termal düz metin — ₺ yerine TL (bazı ESC/POS sürücülerde sembol bozulmasın) */
function formatReceiptMoneyPlain(amount: number): string {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} TL`;
}

function formatReceiptDateTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function truncateName(name: string, max = 32): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function buildReceiptFromCart(
  cart: CartItem[],
  products: Product[],
  paymentMethod: SaleReceiptData['paymentMethod'],
  total: number,
  businessName: string,
  meta?: { receiptNo?: string; saleId?: string; createdAt?: Date },
  productSets: ProductSet[] = [],
): SaleReceiptData {
  const items = cart.map((item) => {
    if (item.setId) {
      const set = productSets.find((entry) => entry.id === item.setId);
      const name = set?.name ?? `Set ${item.setId}`;
      return {
        name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
      };
    }
    const product = products.find((p) => p.id === item.productId);
    const name = product?.name ?? `Ürün #${item.productId}`;
    return {
      name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    };
  });

  return {
    businessName,
    receiptNo: meta?.receiptNo,
    saleId: meta?.saleId,
    createdAt: meta?.createdAt ?? new Date(),
    paymentMethod,
    items,
    total,
  };
}

export function buildReturnReceipt(
  returnRecord: SaleReturn,
  sale: Sale,
  products: Product[],
  productSets: ProductSet[],
  businessName: string,
  meta?: { createdAt?: Date },
): ReturnReceiptData {
  const items: ReturnReceiptLineItem[] = returnRecord.items.map((line) => {
    let name: string;
    if (line.setId) {
      name = productSets.find((set) => set.id === line.setId)?.name ?? `Set ${line.setId}`;
    } else {
      name = products.find((product) => product.id === line.productId)?.name ?? `Ürün #${line.productId}`;
    }
    const lineTotal = line.priceType === 'sample' ? 0 : line.unitPrice * line.quantity;
    return {
      name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal,
      priceType: line.priceType,
    };
  });

  return {
    businessName,
    returnId: returnRecord.id,
    originalSaleId: sale.id,
    originalSaleDate: new Date(sale.createdAt),
    createdAt: meta?.createdAt ?? new Date(returnRecord.createdAt),
    refundMethod: returnRecord.refundMethod,
    items,
    refundTotal: returnRecord.refundTotal,
    reason: returnRecord.reason,
    note: returnRecord.note,
    cashierName: returnRecord.cashierName,
  };
}

function receiptPageCss(paperWidthMm: 58 | 80, pageMarginMm = 0): string {
  const m = Math.min(8, Math.max(0, pageMarginMm));
  return `@page { size: ${paperWidthMm}mm auto; margin: ${m}mm; }`;
}

/** Termal: sans-serif + tek punto (Courier küçük raster’da silik; TOPLAM büyük punto koyu kalıyordu) */
const RECEIPT_THERMAL_FONT =
  'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif';

const RECEIPT_THERMAL_BOLD_CSS = `
    body.receipt-thermal,
    body.receipt-thermal * {
      font-family: ${RECEIPT_THERMAL_FONT} !important;
      font-size: 18px !important;
      font-weight: 900 !important;
      color: #000 !important;
      -webkit-font-smoothing: none;
      font-synthesis: weight;
    }
    body.receipt-thermal .title {
      font-size: 19px !important;
    }
    body.receipt-thermal .total-row td,
    body.receipt-thermal .total-row .line-price,
    body.receipt-thermal .meta-row,
    body.receipt-thermal .meta-row strong {
      font-size: 18px !important;
      font-weight: 900 !important;
    }`;

/** filter/text-shadow CUPS rastertopos’ta bbox’ı bozup 1–2 cm’lik boş kesik fiş yapabiliyor */
const THERMAL_PRINT_DARK_CSS = `
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body.receipt-thermal,
      body.receipt-thermal * {
        font-weight: 900 !important;
        color: #000 !important;
      }
      .divider { border-top-width: 2px; border-top-style: solid; }
    }`;

function receiptBaseStyles(paperWidthMm: 58 | 80 = 80, pageMarginMm = 0): string {
  const bodyWidth = paperWidthMm === 58 ? 50 : 72;
  return `
    ${receiptPageCss(paperWidthMm, pageMarginMm)}
    ${RECEIPT_THERMAL_BOLD_CSS}
    ${THERMAL_PRINT_DARK_CSS}
    @media screen {
      html, body { margin: 0 !important; padding: 0 !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      width: ${bodyWidth}mm;
      font-family: ${RECEIPT_THERMAL_FONT};
      font-size: 18px;
      font-weight: 900;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .title { font-size: 16px; font-weight: 900; margin-bottom: 2px; }
    .muted { color: #000; font-size: 14px; font-weight: 900; }
    .divider {
      border: none;
      border-top: 2px solid #000;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .line td { padding: 2px 0; vertical-align: top; font-weight: 900; }
    .line-name { width: 68%; word-break: break-word; }
    .line-price { width: 32%; text-align: right; white-space: nowrap; }
    .line-sub td {
      padding: 0 0 4px;
      font-size: 13px;
      font-weight: 900;
      color: #000;
    }
    .total-row td {
      padding-top: 6px;
      font-size: 15px;
      font-weight: 900;
    }
    .total-row .line-price { font-size: 15px; font-weight: 900; }
    .footer { margin-top: 10px; font-size: 18px; font-weight: 900; }
    .meta-row { font-size: 18px; font-weight: 900; }
    ${receiptTailSpacerCss()}
  `;
}

/** Termal: sabit @page yüksekliği veya kısa ölçüm → Mac POS-80C erken keser */
function buildReceiptPrintScript(
  paperWidthMm: 58 | 80 = 80,
  fixedRollHeightMm?: number,
): string {
  const blankTitle = BLANK_PRINT_TITLE;
  const rollMm = fixedRollHeightMm ?? 0;
  return `
  <script>
    (function () {
      var t = ${JSON.stringify(blankTitle)};
      var paperW = ${paperWidthMm};
      var fixedRoll = ${rollMm};
      var CUT_MARGIN_MM = 36;
      function measureReceiptHeightPx() {
        var b = document.body;
        var r = document.documentElement;
        var marker = document.getElementById('receipt-end-marker');
        if (marker && b) {
          var top = b.getBoundingClientRect().top;
          var bottom = marker.getBoundingClientRect().bottom;
          if (bottom > top) return Math.ceil(bottom - top);
        }
        return Math.max(
          b ? b.scrollHeight : 0,
          r ? r.scrollHeight : 0,
          b ? b.offsetHeight : 0,
          b ? b.getBoundingClientRect().height : 0
        );
      }
      function applyReceiptPageHeight() {
        var mm = fixedRoll > 0 ? fixedRoll : 0;
        if (!mm) {
          var px = measureReceiptHeightPx();
          mm = Math.ceil(px * 25.4 / 96) + CUT_MARGIN_MM;
          if (mm < 140) mm = 140;
          if (mm > 2400) mm = 2400;
        }
        var el = document.getElementById('receipt-page-dynamic');
        if (!el) {
          el = document.createElement('style');
          el.id = 'receipt-page-dynamic';
          document.head.appendChild(el);
        }
        el.textContent =
          '@page { size: ' + paperW + 'mm ' + mm + 'mm !important; margin: 0 !important; }';
      }
      function before() {
        document.title = t;
        applyReceiptPageHeight();
      }
      window.applyReceiptPageHeight = applyReceiptPageHeight;
      window.onbeforeprint = before;
    })();
  </script>`;
}

const RECEIPT_TAIL_SPACER =
  '<div id="receipt-end-marker" class="receipt-tail-spacer" aria-hidden="true"></div>';

function receiptTailSpacerCss(): string {
  return `.receipt-tail-spacer { height: 12mm; width: 100%; flex-shrink: 0; }`;
}

type ReceiptPrintWindow = Window & { applyReceiptPageHeight?: () => void };

function applyReceiptPageHeightInWindow(win: ReceiptPrintWindow): void {
  try {
    win.applyReceiptPageHeight?.();
  } catch {
    /* ignore */
  }
}

/** Layout + fontlar otursun, sonra ölçüm ve yazdır (beforeprint tek başına yetmeyebilir) */
function scheduleThermalPrintInWindow(win: ReceiptPrintWindow, onError?: () => void): void {
  const doc = win.document;
  const trigger = () => {
    applyReceiptPageHeightInWindow(win);
    window.setTimeout(() => {
      applyReceiptPageHeightInWindow(win);
      try {
        doc.title = BLANK_PRINT_TITLE;
        win.focus();
        win.print();
      } catch {
        onError?.();
      }
    }, 60);
  };
  const afterLayout = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(trigger);
    });
  };
  if (doc.readyState === 'complete') {
    window.setTimeout(afterLayout, 120);
  } else {
    win.addEventListener('load', () => window.setTimeout(afterLayout, 120), { once: true });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapPlainReceiptBody(
  body: string,
  paperWidthMm: 58 | 80,
  pageMarginMm = 0,
): string {
  const width = paperWidthMm === 58 ? 50 : 72;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${BLANK_PRINT_TITLE}</title>
  <style>
    ${receiptPageCss(paperWidthMm, pageMarginMm)}
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
    }
    body {
      margin: 0;
      padding: 0;
      width: ${width}mm;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      white-space: pre-wrap;
      color: #000;
      background: #fff;
    }
  </style>
</head>
<body>${escapeHtml(body)}</body>
</html>`;
}

export function buildPlainTextSaleReceipt(data: SaleReceiptData): string {
  const receiptRef = data.receiptNo || data.saleId || '—';
  const lines: string[] = [
    data.businessName.toUpperCase(),
    'SATIŞ FİŞİ',
    '--------------------------------',
    `Tarih: ${formatReceiptDateTime(data.createdAt)}`,
    `Fiş No: ${receiptRef}`,
    `Ödeme: ${PAYMENT_LABELS[data.paymentMethod]}`,
    '--------------------------------',
  ];
  for (const item of data.items) {
    lines.push(truncateName(item.name, 28));
    lines.push(`  ${item.quantity} x ${formatReceiptMoneyPlain(item.unitPrice)}`);
    lines.push(`  ${formatReceiptMoneyPlain(item.lineTotal)}`);
  }
  lines.push('--------------------------------');
  lines.push(`TOPLAM  ${formatReceiptMoneyPlain(data.total)}`);
  lines.push('');
  lines.push('Teşekkürler.');
  return lines.join('\n');
}

export function buildReturnReceiptHtml(data: ReturnReceiptData, paperWidthMm: 58 | 80 = 80): string {
  const lines = data.items
    .map((item) => {
      const sample = item.priceType === 'sample';
      const left = `${truncateName(item.name)} x${item.quantity}${sample ? ' (Numune)' : ''}`;
      const right = sample ? 'NUMUNE' : `-${formatReceiptMoney(item.lineTotal)}`;
      return `
        <tr class="line">
          <td class="line-name">${left}</td>
          <td class="line-price">${right}</td>
        </tr>
        <tr class="line-sub">
          <td colspan="2">İADE · ${item.quantity} x ${sample ? 'Numune' : formatReceiptMoney(item.unitPrice)}</td>
        </tr>
      `;
    })
    .join('');

  const originalSaleDate = data.originalSaleDate
    ? formatReceiptDateTime(data.originalSaleDate)
    : '—';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${BLANK_PRINT_TITLE}</title>
  <style>
    ${receiptBaseStyles(paperWidthMm)}
    .return-banner {
      margin: 8px 0;
      padding: 8px 4px;
      border: 2px solid #000;
      text-align: center;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.08em;
    }
    .return-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      margin-top: 2px;
    }
    .return-total .line-price {
      color: #000;
      font-size: 15px;
    }
    .return-warning {
      margin-top: 8px;
      padding: 6px 4px;
      border: 1px solid #000;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
    }
  </style>
</head>
<body class="receipt-thermal">
  <div class="center title">${data.businessName}</div>
  <div class="return-banner">
    İADE FİŞİ
    <div class="return-subtitle">RETURN / REFUND</div>
  </div>
  <hr class="divider" />
  <div>İade No: ${data.returnId}</div>
  <div>Orijinal Fiş: ${data.originalSaleId}</div>
  <div>Orijinal Satış: ${originalSaleDate}</div>
  <div>İade Tarihi: ${formatReceiptDateTime(data.createdAt)}</div>
  ${data.cashierName ? `<div>İade Kasiyeri: ${data.cashierName}</div>` : ''}
  <div>İade Ödemesi: ${PAYMENT_LABELS[data.refundMethod]}</div>
  ${data.reason ? `<div>İade Nedeni: ${data.reason}</div>` : ''}
  ${data.note ? `<div>Not: ${data.note}</div>` : ''}
  <hr class="divider" />
  <table>
    <tbody>
      ${lines}
      <tr class="total-row line return-total">
        <td class="line-name bold">İADE TOPLAMI</td>
        <td class="line-price">-${formatReceiptMoney(data.refundTotal)}</td>
      </tr>
    </tbody>
  </table>
  <hr class="divider" />
  <div class="return-warning">BU BELGE İADE İŞLEMİDİR — SATIŞ FİŞİ DEĞİLDİR</div>
  <div class="center footer">
    <div>İade işleminiz kaydedilmiştir.</div>
    <div>İyi günler dileriz.</div>
  </div>
  ${RECEIPT_TAIL_SPACER}
</body>
</html>`;
}

export function buildReceiptHtml(
  data: SaleReceiptData,
  paperWidthMm: 58 | 80 = 80,
  pageMarginMm = 0,
): string {
  const lines = data.items
    .map((item) => {
      const left = `${truncateName(item.name)} x${item.quantity}`;
      const right = formatReceiptMoney(item.lineTotal);
      return `
        <tr class="line total-row">
          <td class="line-name bold">${left}</td>
          <td class="line-price">${right}</td>
        </tr>
        <tr class="line-sub total-row">
          <td colspan="2">${item.quantity} x ${formatReceiptMoney(item.unitPrice)}</td>
        </tr>
      `;
    })
    .join('');

  const receiptRef = data.receiptNo || data.saleId || '—';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=302" />
  <title>${BLANK_PRINT_TITLE}</title>
  <style>
    ${receiptBaseStyles(paperWidthMm, pageMarginMm)}
  </style>
</head>
<body class="receipt-thermal" data-receipt-layout="80mm-v9">
  <div class="center title total-row"><strong>${data.businessName}</strong></div>
  <div class="center muted"><strong>SATIŞ FİŞİ</strong></div>
  <hr class="divider" />
  <div class="meta-row"><strong>Tarih: ${formatReceiptDateTime(data.createdAt)}</strong></div>
  <div class="meta-row"><strong>Fiş No: ${receiptRef}</strong></div>
  <div class="meta-row"><strong>Ödeme: ${PAYMENT_LABELS[data.paymentMethod]}</strong></div>
  <hr class="divider" />
  <table>
    <tbody>
      ${lines}
      <tr class="total-row line">
        <td class="line-name bold">TOPLAM</td>
        <td class="line-price">${formatReceiptMoney(data.total)}</td>
      </tr>
    </tbody>
  </table>
  <hr class="divider" />
  <div class="center footer">
    <div><strong>Bizi tercih ettiğiniz için teşekkürler.</strong></div>
    <div><strong>İyi günler dileriz.</strong></div>
  </div>
  ${RECEIPT_TAIL_SPACER}
</body>
</html>`;
}

const CLASSIC_RECEIPT_80MM_FIX = `
  <style>
    @media print {
      html, body {
        width: 72mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        zoom: 1 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body.receipt-thermal,
      body.receipt-thermal * {
        font-family: ${RECEIPT_THERMAL_FONT} !important;
        font-weight: 900 !important;
        font-size: 18px !important;
        color: #000 !important;
      }
      body.receipt-plain-thermal {
        font-family: ${RECEIPT_THERMAL_FONT} !important;
        font-size: 15px !important;
        font-weight: 700 !important;
        line-height: 1.4 !important;
        color: #000 !important;
      }
    }
  </style>`;

/** Lima klasik: düz metin — HTML tablo Firefox+CUPS’ta kısa kesik raster yapıyordu */
export function buildGreenleafPlainReceiptHtml(data: SaleReceiptData): string {
  const plain = buildPlainTextSaleReceipt(data);
  return wrapPlainReceiptBody(plain, 80, 0)
    .replace(
      'font-size: 11px;',
      `font-size: 15px;\n      font-weight: 700;\n      font-family: ${RECEIPT_THERMAL_FONT};`,
    )
    .replace('</head>', `${CLASSIC_RECEIPT_80MM_FIX}</head>`)
    .replace(
      '</body>',
      `${RECEIPT_TAIL_SPACER}\n${buildReceiptPrintScript(80)}\n</body>`,
    )
    .replace('<body>', '<body class="receipt-plain-thermal" data-receipt-layout="plain-v10">');
}

/** HTML tablo fiş (yedek / test) */
export function buildGreenleafSaleReceiptHtml(data: SaleReceiptData): string {
  const body = buildReceiptHtml(data, 80, 0).replace(
    /@page\s*\{\s*size:\s*80mm\s+auto[^}]*\}/,
    '',
  );
  return body
    .replace(
      '<meta charset="utf-8" />',
      '<meta charset="utf-8" />\n  <meta name="viewport" content="width=302" />',
    )
    .replace('</head>', `${CLASSIC_RECEIPT_80MM_FIX}</head>`)
    .replace('</body>', `${buildReceiptPrintScript(80)}\n</body>`);
}

/** 80 mm ≈ 302px — opacity:0 / 0×0 iframe Firefox’ta fişi birkaç mm’ye indiriyordu */
const THERMAL_PRINT_IFRAME_STYLE =
  'position:fixed;left:0;top:0;width:302px;min-height:400px;height:auto;border:0;margin:0;padding:0;z-index:-1;pointer-events:none;overflow:visible;';

/** Görünmez iframe (80 mm genişlik) — ayrı Firefox penceresi açmaz */
function printHtmlReceiptClassicIframe(html: string): Promise<void> {
  return new Promise((resolve) => {
    logReceiptPrint('classic-plain-iframe-start', { htmlBytes: html.length });
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = THERMAL_PRINT_IFRAME_STYLE;
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!doc || !win) {
      logReceiptPrint('error-no-iframe-window');
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      logReceiptPrint('classic-done');
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
    };

    win.addEventListener('beforeprint', () => {
      applyReceiptPageHeightInWindow(win);
      logReceiptPrint('beforeprint');
    });
    win.addEventListener('afterprint', cleanup, { once: true });

    scheduleThermalPrintInWindow(win, () => {
      logReceiptPrint('error-parent-print');
      cleanup();
    });

    setTimeout(cleanup, 60_000);
  });
}

function printHtmlReceiptClassic(html: string): Promise<void> {
  return printHtmlReceiptClassicIframe(html);
}

function printHtmlReceiptInWindow(win: Window, html: string, onDone: () => void): void {
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();
  doc.title = BLANK_PRINT_TITLE;

  const cleanup = () => {
    onDone();
  };

  win.addEventListener('beforeprint', () => {
    doc.title = BLANK_PRINT_TITLE;
    applyReceiptPageHeightInWindow(win);
  });
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 60_000);

  scheduleThermalPrintInWindow(win, cleanup);
}

function printHtmlReceiptViaIframe(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = THERMAL_PRINT_IFRAME_STYLE;
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }
    printHtmlReceiptInWindow(win, html, () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
    });
  });
}

/** Termal fiş: görünür yazdırma penceresi (gizli iframe Mac/termalde PDF ham veri basıyordu) */
export function printHtmlReceipt(html: string): Promise<void> {
  return new Promise((resolve) => {
    logReceiptPrint('advanced-start', { htmlBytes: html.length });
    const features =
      'popup,width=360,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes';
    const printWin = window.open('', 'market-pos-receipt-print', features);
    if (!printWin) {
      logReceiptPrint('popup-blocked', { fallback: 'iframe' });
      void printHtmlReceiptViaIframe(html).then(resolve);
      return;
    }
    printHtmlReceiptInWindow(printWin, html, () => {
      try {
        printWin.close();
      } catch {
        /* ignore */
      }
      resolve();
    });
  });
}

export async function printTestSaleReceipt(businessName: string): Promise<void> {
  const sample: SaleReceiptData = {
    businessName,
    createdAt: new Date(),
    paymentMethod: 'cash',
    total: 1,
    items: [{ name: 'TEST FIS', quantity: 1, unitPrice: 1, lineTotal: 1 }],
    saleId: 'TEST',
  };
  logReceiptPrint('test-print');
  await printThermalReceipt(sample);
}

export async function printThermalReceipt(
  data: SaleReceiptData,
  options?: ThermalReceiptPrintOptions,
): Promise<void> {
  if (options === undefined) {
    logReceiptPrint('thermal-classic-path', { saleId: data.saleId, items: data.items.length });
    remindChromeReceiptPrintSettings();
    await printHtmlReceiptClassicIframe(buildGreenleafPlainReceiptHtml(data));
    return;
  }
  const normalized = normalizeReceiptPrinterSettings(options);
  logReceiptPrint('thermal-advanced-path', {
    saleId: data.saleId,
    printMode: normalized.printMode,
    paperWidthMm: normalized.paperWidthMm,
  });
  const paper = normalized.paperWidthMm;
  const copies = normalized.copies;
  const margin = normalized.pageMarginMm;
  const mode = normalized.printMode === 'plain' ? 'plain' : 'html';
  const html =
    mode === 'plain'
      ? wrapPlainReceiptBody(buildPlainTextSaleReceipt(data), paper, margin)
      : buildReceiptHtml(data, paper, margin);
  for (let i = 0; i < copies; i += 1) {
    await printHtmlReceipt(html);
  }
}

export function printReturnReceipt(
  data: ReturnReceiptData,
  paperWidthMm: 58 | 80 = 80,
): Promise<void> {
  const html = buildReturnReceiptHtml(data, paperWidthMm)
    .replace('</body>', `${RECEIPT_TAIL_SPACER}\n</body>`)
    .replace('</body>', `${buildReceiptPrintScript(paperWidthMm)}\n</body>`);
  return printHtmlReceiptClassic(html);
}
