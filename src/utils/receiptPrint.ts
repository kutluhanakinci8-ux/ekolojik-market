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

const THERMAL_PRINT_DARK_CSS = `
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body.receipt-thermal {
        filter: contrast(1.65) brightness(0.84);
      }
      body.receipt-thermal * {
        -webkit-text-stroke: 0.3px #000;
        text-shadow: 0.5px 0 0 #000, -0.5px 0 0 #000;
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
  `;
}

/** Chrome/Safari: @page auto → kısa sayfa, termal erken keser; içeriğe göre mm yükseklik */
function buildReceiptPrintScript(): string {
  const blankTitle = BLANK_PRINT_TITLE;
  return `
  <script>
    (function () {
      var t = ${JSON.stringify(blankTitle)};
      function applyReceiptPageHeight() {
        var b = document.body;
        var r = document.documentElement;
        var px = Math.max(b ? b.scrollHeight : 0, r ? r.scrollHeight : 0, b ? b.offsetHeight : 0);
        var mm = Math.ceil(px * 25.4 / 96) + 16;
        if (mm < 120) mm = 120;
        if (mm > 2000) mm = 2000;
        var el = document.getElementById('receipt-page-dynamic');
        if (!el) {
          el = document.createElement('style');
          el.id = 'receipt-page-dynamic';
          document.head.appendChild(el);
        }
        el.textContent = '@page { size: 80mm ' + mm + 'mm !important; margin: 0 !important; }';
      }
      function before() {
        document.title = t;
        applyReceiptPageHeight();
      }
      window.onbeforeprint = before;
      window.onload = function () {
        before();
        setTimeout(function () {
          applyReceiptPageHeight();
          window.print();
        }, 150);
      };
    })();
  </script>`;
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
  <title>${BLANK_PRINT_TITLE}</title>
  <style>
    ${receiptBaseStyles(paperWidthMm, pageMarginMm)}
  </style>
</head>
<body class="receipt-thermal" data-receipt-layout="80mm-v6">
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
</body>
</html>`;
}

/** POS-80C Mac: 80 mm rulo — 58mm/inç + «sayfa genişliğine sığdır» silik raster yapıyordu */
const CLASSIC_RECEIPT_80MM_FIX = `
  <style>
    @page { size: 80mm 297mm; margin: 0 !important; }
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
    }
  </style>`;

/** Klasik kasa fişi (Lima / yönetici): 80 mm termal, gizli iframe */
export function buildGreenleafSaleReceiptHtml(data: SaleReceiptData): string {
  const body = buildReceiptHtml(data, 80, 0);
  return body
    .replace('</head>', `${CLASSIC_RECEIPT_80MM_FIX}</head>`)
    .replace('</body>', `${buildReceiptPrintScript()}\n</body>`);
}

/** Gizli iframe — yazdırma yalnızca fiş HTML içindeki onload script ile (parent print yok) */
function printHtmlReceiptClassic(html: string): Promise<void> {
  return new Promise((resolve) => {
    logReceiptPrint('classic-start', { htmlBytes: html.length });
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
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

    let sawBeforePrint = false;
    const cleanup = () => {
      logReceiptPrint('classic-done');
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
    };

    win.addEventListener('beforeprint', () => {
      sawBeforePrint = true;
      logReceiptPrint('beforeprint');
    });
    win.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      if (!sawBeforePrint) {
        logReceiptPrint('fallback-parent-print', { reason: 'onload-script-blocked-or-slow' });
        try {
          win.focus();
          win.print();
        } catch (err) {
          logReceiptPrint('error-parent-print', { message: String(err) });
        }
      }
    }, 450);

    setTimeout(cleanup, 8000);
  });
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

  const triggerPrint = () => {
    try {
      doc.title = BLANK_PRINT_TITLE;
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };

  win.addEventListener('beforeprint', () => {
    doc.title = BLANK_PRINT_TITLE;
  });
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 60_000);

  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 180);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 180), { once: true });
  }
}

function printHtmlReceiptViaIframe(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;border:0;opacity:0.01;pointer-events:none;';
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
    await printHtmlReceiptClassic(buildGreenleafSaleReceiptHtml(data));
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
  const html = buildReturnReceiptHtml(data, paperWidthMm).replace(
    '</body>',
    `${buildReceiptPrintScript()}\n</body>`,
  );
  return printHtmlReceiptClassic(html);
}
