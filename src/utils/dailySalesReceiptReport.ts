import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { getPaymentBreakdown } from './analytics';
import { formatBusinessDateLabel } from './cashSession';
import { getLastLimaRawPrintError, tryLimaRawReceiptPrint } from './limaRawReceiptPrint';
import { printHtmlReceipt } from './receiptPrint';
import { toThermalReceiptAscii } from './thermalReceiptAscii';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../types/receiptPrinter';

const PLAIN_LINE_WIDTH = 48;

export interface DailySalesReceiptReportData {
  businessName: string;
  businessDateKey: string;
  createdAt: Date;
  sales: Sale[];
  saleReturns: SaleReturn[];
}

const PAYMENT_SHORT: Record<Sale['paymentMethod'], string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
  split: 'Bolunmus',
  gift: 'Hediye',
};

function formatReceiptMoney(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount)
    .replace(/\u00a0/g, ' ');
}

function formatReceiptDateTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function plainPadLine(left: string, right: string, width = PLAIN_LINE_WIDTH): string {
  const r = right.trim();
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.length > maxLeft ? `${left.slice(0, maxLeft - 1)}.` : left;
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(spaces)}${r}`;
}

function salePaymentLabel(sale: Sale): string {
  if (sale.paymentMethod === 'split' && sale.paymentSplits?.length) {
    const parts = sale.paymentSplits.map((s) => {
      const label = PAYMENT_SHORT[s.method] ?? s.method;
      return `${label} ${formatReceiptMoney(s.amount)}`;
    });
    return parts.join(' + ');
  }
  return PAYMENT_SHORT[sale.paymentMethod] ?? sale.paymentMethod;
}

function sortedSalesChronological(sales: Sale[]): Sale[] {
  return [...sales].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function buildPlainTextDailySalesReceipt(
  data: DailySalesReceiptReportData,
  paperWidthMm: 58 | 80 = 80,
): string {
  const lineWidth = paperWidthMm === 58 ? 32 : PLAIN_LINE_WIDTH;
  const rule = '-'.repeat(Math.min(lineWidth, PLAIN_LINE_WIDTH));
  const breakdown = getPaymentBreakdown(data.sales, data.saleReturns);
  const chronological = sortedSalesChronological(data.sales);
  const grossTotal = data.sales.reduce((sum, s) => sum + s.total, 0);
  const returnTotal = data.saleReturns.reduce((sum, r) => sum + r.refundTotal, 0);
  const netTotal = grossTotal - returnTotal;

  const lines: string[] = [
    data.businessName.trim(),
    'GUNLUK SATIS LISTESI',
    rule,
    `Gun: ${data.businessDateKey}`,
    `Yazdirma: ${formatReceiptDateTime(data.createdAt)}`,
    rule,
    `${chronological.length} satis`,
  ];

  for (const sale of chronological) {
    const money = formatReceiptMoney(sale.total).replace(/\u00a0/g, ' ');
    lines.push(plainPadLine(sale.id, money, lineWidth));
    const pay = salePaymentLabel(sale);
    if (pay && sale.paymentMethod !== 'cash') {
      lines.push(`  ${pay}`);
    }
  }

  if (data.saleReturns.length > 0) {
    lines.push(rule);
    lines.push('IADELER');
    for (const entry of data.saleReturns) {
      const money = `-${formatReceiptMoney(entry.refundTotal).replace(/\u00a0/g, ' ')}`;
      lines.push(plainPadLine(entry.originalSaleId ?? entry.id, money, lineWidth));
    }
  }

  lines.push(rule);
  lines.push(plainPadLine('SATIS TOPLAMI', formatReceiptMoney(grossTotal), lineWidth));
  if (returnTotal > 0) {
    lines.push(plainPadLine('Iade', `-${formatReceiptMoney(returnTotal)}`, lineWidth));
  }
  lines.push(plainPadLine('GENEL TOPLAM', formatReceiptMoney(netTotal), lineWidth));
  lines.push(rule);
  lines.push('ODEME KIRILIMI');
  lines.push(plainPadLine('Nakit', formatReceiptMoney(breakdown.cash), lineWidth));
  lines.push(plainPadLine('Kart', formatReceiptMoney(breakdown.card), lineWidth));
  lines.push(plainPadLine('Havale', formatReceiptMoney(breakdown.transfer), lineWidth));
  if (breakdown.credit !== 0) {
    lines.push(plainPadLine('Veresiye', formatReceiptMoney(breakdown.credit), lineWidth));
  }
  lines.push(rule);
  lines.push('Bilgi amaclidir.');

  return toThermalReceiptAscii(lines.join('\n'));
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
      font-size: 10px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .title { font-size: 13px; font-weight: 800; margin-bottom: 2px; }
    .banner {
      margin: 8px 0;
      padding: 8px 4px;
      border: 2px solid #000;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
    }
    .divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .row td { padding: 2px 0; vertical-align: top; }
    .row-id { width: 62%; font-size: 9px; word-break: break-all; }
    .row-amt { width: 38%; text-align: right; white-space: nowrap; font-weight: 600; }
    .row-pay td { padding: 0 0 4px; font-size: 8px; color: #333; }
    .summary td { padding: 2px 0; }
    .total td { padding-top: 6px; font-weight: 800; font-size: 11px; }
    .footer { margin-top: 10px; font-size: 9px; text-align: center; }
  `;
}

export function buildDailySalesReceiptHtml(data: DailySalesReceiptReportData): string {
  const breakdown = getPaymentBreakdown(data.sales, data.saleReturns);
  const chronological = sortedSalesChronological(data.sales);
  const grossTotal = data.sales.reduce((sum, s) => sum + s.total, 0);
  const returnTotal = data.saleReturns.reduce((sum, r) => sum + r.refundTotal, 0);
  const netTotal = grossTotal - returnTotal;

  const saleRows = chronological.map((sale) => {
    const pay = salePaymentLabel(sale);
    const payRow = sale.paymentMethod !== 'cash'
      ? `<tr class="row-pay"><td colspan="2">${pay}</td></tr>`
      : '';
    return `
      <tr class="row">
        <td class="row-id"><code>${sale.id}</code></td>
        <td class="row-amt">${formatReceiptMoney(sale.total)}</td>
      </tr>
      ${payRow}
    `;
  }).join('');

  const returnRows = data.saleReturns.map((entry) => `
    <tr class="row">
      <td class="row-id"><code>${entry.originalSaleId ?? entry.id}</code> (iade)</td>
      <td class="row-amt">−${formatReceiptMoney(entry.refundTotal)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Günlük satış listesi</title>
  <style>${receiptBaseStyles()}</style>
</head>
<body>
  <div class="center title">${data.businessName}</div>
  <div class="banner">GÜNLÜK SATIŞ LİSTESİ</div>
  <div>Gün: ${formatBusinessDateLabel(data.businessDateKey)}</div>
  <div>Yazdırma: ${formatReceiptDateTime(data.createdAt)}</div>
  <hr class="divider" />
  <div class="bold">${chronological.length} satış</div>
  <table>
    <tbody>
      ${saleRows || '<tr><td colspan="2">Bu gün satış yok.</td></tr>'}
      ${returnRows}
    </tbody>
  </table>
  <hr class="divider" />
  <table class="summary">
    <tbody>
      <tr class="summary"><td>Satış toplamı</td><td style="text-align:right">${formatReceiptMoney(grossTotal)}</td></tr>
      ${returnTotal > 0 ? `<tr class="summary"><td>İade</td><td style="text-align:right">−${formatReceiptMoney(returnTotal)}</td></tr>` : ''}
      <tr class="total"><td>Genel toplam</td><td style="text-align:right">${formatReceiptMoney(netTotal)}</td></tr>
    </tbody>
  </table>
  <hr class="divider" />
  <div class="bold center">Ödeme kırılımı</div>
  <table class="summary">
    <tbody>
      <tr><td>Nakit</td><td style="text-align:right">${formatReceiptMoney(breakdown.cash)}</td></tr>
      <tr><td>Kart</td><td style="text-align:right">${formatReceiptMoney(breakdown.card)}</td></tr>
      <tr><td>Havale</td><td style="text-align:right">${formatReceiptMoney(breakdown.transfer)}</td></tr>
      ${breakdown.credit !== 0 ? `<tr><td>Veresiye</td><td style="text-align:right">${formatReceiptMoney(breakdown.credit)}</td></tr>` : ''}
    </tbody>
  </table>
  <div class="footer">Bilgi amaçlıdır.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},120);};</script>
</body>
</html>`;
}

export interface PrintDailySalesReceiptResult {
  printed: boolean;
  thermal?: boolean;
  message?: string;
}

export async function printDailySalesReceiptReport(
  data: DailySalesReceiptReportData,
  windowsPrinterName?: string,
): Promise<PrintDailySalesReceiptResult> {
  const printerName = windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;
  const plain = buildPlainTextDailySalesReceipt(data);
  const rawOk = await tryLimaRawReceiptPrint(plain, printerName);
  if (rawOk) {
    return { printed: true, thermal: true, message: 'Günlük satış listesi yazdırıldı (termal)' };
  }
  const rawErr = getLastLimaRawPrintError();
  if (rawErr) {
    await printHtmlReceipt(buildDailySalesReceiptHtml(data));
    return {
      printed: true,
      thermal: false,
      message: `${rawErr} — tarayıcı yazdırma açıldı`,
    };
  }
  await printHtmlReceipt(buildDailySalesReceiptHtml(data));
  return { printed: true, thermal: false, message: 'Tarayıcı yazdırma açıldı' };
}
