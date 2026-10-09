import type { CartItem, PriceType, Product, Sale } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { SaleReturn } from '../types/saleReturn';
import type { ThermalReceiptPrintOptions } from '../types/receiptPrinter';
import { normalizeReceiptPrinterSettings } from '../types/receiptPrinter';

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

function receiptBaseStyles(paperWidthMm: 58 | 80 = 80, pageMarginMm = 0): string {
  const bodyWidth = paperWidthMm === 58 ? 50 : 72;
  return `
    ${receiptPageCss(paperWidthMm, pageMarginMm)}
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      width: ${bodyWidth}mm;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .title { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
    .muted { color: #333; font-size: 10px; }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .line td { padding: 2px 0; vertical-align: top; }
    .line-name { width: 68%; word-break: break-word; }
    .line-price { width: 32%; text-align: right; white-space: nowrap; }
    .line-sub td {
      padding: 0 0 4px;
      font-size: 9px;
      color: #444;
    }
    .total-row td {
      padding-top: 6px;
      font-size: 13px;
      font-weight: 800;
    }
    .total-row .line-price { font-size: 14px; }
    .footer { margin-top: 10px; font-size: 10px; }
  `;
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
    lines.push(`  ${item.quantity} x ${formatReceiptMoney(item.unitPrice)}`);
    lines.push(`  ${formatReceiptMoney(item.lineTotal)}`);
  }
  lines.push('--------------------------------');
  lines.push(`TOPLAM  ${formatReceiptMoney(data.total)}`);
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
<body>
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
        <tr class="line">
          <td class="line-name">${left}</td>
          <td class="line-price">${right}</td>
        </tr>
        <tr class="line-sub">
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
<body>
  <div class="center title">${data.businessName}</div>
  <div class="center muted">SATIŞ FİŞİ</div>
  <hr class="divider" />
  <div>Tarih: ${formatReceiptDateTime(data.createdAt)}</div>
  <div>Fiş No: ${receiptRef}</div>
  <div>Ödeme: ${PAYMENT_LABELS[data.paymentMethod]}</div>
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
    <div>Bizi tercih ettiğiniz için teşekkürler.</div>
    <div>İyi günler dileriz.</div>
  </div>
</body>
</html>`;
}

export function printHtmlReceipt(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!doc || !win) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    doc.title = BLANK_PRINT_TITLE;

    const cleanup = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
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
    setTimeout(cleanup, 15000);

    if (doc.readyState === 'complete') {
      setTimeout(triggerPrint, 120);
    } else {
      win.addEventListener('load', () => setTimeout(triggerPrint, 120), { once: true });
    }
  });
}

export async function printThermalReceipt(
  data: SaleReceiptData,
  options?: ThermalReceiptPrintOptions,
): Promise<void> {
  const normalized = normalizeReceiptPrinterSettings(options ?? undefined);
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
  return printHtmlReceipt(buildReturnReceiptHtml(data, paperWidthMm));
}
