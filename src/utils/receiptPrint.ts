import type { CartItem, PriceType, Product, Sale } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { SaleReturn } from '../types/saleReturn';

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

function receiptBaseStyles(): string {
  return `
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      width: 72mm;
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

function buildReceiptPrintScript(): string {
  return `
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 120);
    };
  </script>`;
}

export function buildReturnReceiptHtml(data: ReturnReceiptData): string {
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
  <title>İade Fişi ${data.returnId}</title>
  <style>
    ${receiptBaseStyles()}
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
  ${buildReceiptPrintScript()}
</body>
</html>`;
}

export function buildReceiptHtml(data: SaleReceiptData): string {
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
  <title>Fiş ${receiptRef}</title>
  <style>
    ${receiptBaseStyles()}
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
  ${buildReceiptPrintScript()}
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

    const cleanup = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 8000);
  });
}

export function printThermalReceipt(data: SaleReceiptData): Promise<void> {
  return printHtmlReceipt(buildReceiptHtml(data));
}

export function printReturnReceipt(data: ReturnReceiptData): Promise<void> {
  return printHtmlReceipt(buildReturnReceiptHtml(data));
}
