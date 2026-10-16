import { isRealFiscalDevicePrint, printFiscalCashReport } from '../services/fiscalBridge';
import {
  CASH_ACTIVITY_KIND_LABELS,
  type CashActivityRow,
  type CashRegisterSummary,
} from './cashRegister';
import { formatBusinessDateLabel } from './cashSession';
import { getLastLimaRawPrintError, tryLimaRawReceiptPrint } from './limaRawReceiptPrint';
import { printHtmlReceipt } from './receiptPrint';
import { toThermalReceiptAscii } from './thermalReceiptAscii';
import type { CashHandover } from '../types/business';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../types/receiptPrinter';

export type CashRegisterReportType = 'day_close' | 'handover';

export interface CashRegisterReceiptData {
  businessName: string;
  reportType: CashRegisterReportType;
  businessDateKey: string;
  createdAt: Date;
  openingBalance: number;
  closingBalance: number;
  rows: CashActivityRow[];
  summary: Pick<
    CashRegisterSummary,
    'saleCount' | 'returnCount' | 'expenseCount' | 'handoverCount'
  >;
  cashierName?: string;
  handover?: Pick<CashHandover, 'amount' | 'recipient' | 'note' | 'createdAt'>;
}

export interface PrintCashRegisterReceiptResult {
  printed: boolean;
  fiscal: boolean;
  thermal?: boolean;
  message?: string;
}

export interface PrintCashRegisterReceiptOptions {
  /** InPOS yok (POS Lite / Zywell) — mali rapor denemesi atlanır */
  skipFiscal?: boolean;
  skipFiscalConfirm?: boolean;
  /** Windows kuyruk adı — dolu ise önce ESC/POS köprüsü (127.0.0.1:18765) */
  windowsPrinterName?: string;
}

const PLAIN_LINE_WIDTH = 48;

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

function formatMovementTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function truncateText(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
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
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.06em;
    }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .meta td { padding: 1px 0; vertical-align: top; }
    .meta-label { width: 42%; }
    .meta-value { width: 58%; text-align: right; }
    .movement td {
      padding: 3px 0;
      vertical-align: top;
      border-bottom: 1px dotted #bbb;
    }
    .movement-time { width: 24%; white-space: nowrap; }
    .movement-kind { width: 18%; font-weight: 700; }
    .movement-amount { width: 28%; text-align: right; white-space: nowrap; }
    .movement-balance { width: 30%; text-align: right; white-space: nowrap; font-weight: 700; }
    .movement-desc td {
      padding: 0 0 4px;
      font-size: 9px;
      color: #333;
    }
    .summary td {
      padding: 2px 0;
      font-size: 10px;
    }
    .total-row td {
      padding-top: 6px;
      font-size: 12px;
      font-weight: 800;
    }
    .footer { margin-top: 10px; font-size: 10px; text-align: center; }
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

export function buildCashRegisterReceiptHtml(data: CashRegisterReceiptData): string {
  const title = data.reportType === 'day_close' ? 'GÜN KAPANIŞ FİŞİ' : 'YÖNETİME NAKİT DEVRİ';
  const subtitle = data.reportType === 'day_close'
    ? 'KASA HAREKETLERİ ÖZETİ'
    : 'KASA HAREKETLERİ + DEVİR';

  const chronological = [...data.rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const movementRows = chronological.map((row) => {
    const signed = row.signedAmount >= 0 ? `+${formatReceiptMoney(row.signedAmount)}` : formatReceiptMoney(row.signedAmount);
    const description = truncateText(`${row.label}${row.sublabel ? ` · ${row.sublabel}` : ''}`);
    return `
      <tr class="movement">
        <td class="movement-time">${formatMovementTime(row.createdAt)}</td>
        <td class="movement-kind">${CASH_ACTIVITY_KIND_LABELS[row.kind]}</td>
        <td class="movement-amount">${signed}</td>
        <td class="movement-balance">${formatReceiptMoney(row.runningBalance)}</td>
      </tr>
      <tr class="movement-desc">
        <td colspan="4">${description} · ${row.paymentLabel}</td>
      </tr>
    `;
  }).join('');

  const handoverBlock = data.handover
    ? `
      <hr class="divider" />
      <table class="meta">
        <tbody>
          <tr class="meta"><td class="meta-label">Devir Tutarı</td><td class="meta-value">${formatReceiptMoney(data.handover.amount)}</td></tr>
          <tr class="meta"><td class="meta-label">Alıcı</td><td class="meta-value">${data.handover.recipient}</td></tr>
          ${data.handover.note ? `<tr class="meta"><td class="meta-label">Not</td><td class="meta-value">${data.handover.note}</td></tr>` : ''}
        </tbody>
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${receiptBaseStyles()}</style>
</head>
<body>
  <div class="center title">${data.businessName}</div>
  <div class="banner">${title}</div>
  <div class="center bold">${subtitle}</div>
  <hr class="divider" />
  <div>Gün: ${formatBusinessDateLabel(data.businessDateKey)}</div>
  <div>Yazdırma: ${formatReceiptDateTime(data.createdAt)}</div>
  ${data.cashierName ? `<div>Kasiyer: ${data.cashierName}</div>` : ''}
  <hr class="divider" />
  <table class="meta">
    <tbody>
      <tr class="meta"><td class="meta-label">Açılış Bakiyesi</td><td class="meta-value">${formatReceiptMoney(data.openingBalance)}</td></tr>
      <tr class="meta"><td class="meta-label">Satış / İade / Gider / Devir</td><td class="meta-value">${data.summary.saleCount} / ${data.summary.returnCount} / ${data.summary.expenseCount} / ${data.summary.handoverCount}</td></tr>
      <tr class="meta total-row"><td class="meta-label">Kapanış Bakiyesi</td><td class="meta-value">${formatReceiptMoney(data.closingBalance)}</td></tr>
    </tbody>
  </table>
  ${handoverBlock}
  <hr class="divider" />
  <table>
    <thead>
      <tr class="movement">
        <td class="movement-time bold">Saat</td>
        <td class="movement-kind bold">Tür</td>
        <td class="movement-amount bold">Tutar</td>
        <td class="movement-balance bold">Bakiye</td>
      </tr>
    </thead>
    <tbody>
      ${movementRows || '<tr class="movement-desc"><td colspan="4">Bu gün için hareket yok.</td></tr>'}
    </tbody>
  </table>
  <hr class="divider" />
  <div class="footer">
    <div>${data.reportType === 'day_close' ? 'Gün kapanış kaydı öncesi kasa hareketleri.' : 'Yönetime devir kaydı sonrası kasa hareketleri.'}</div>
    <div>Bu belge bilgi amaçlıdır.</div>
  </div>
  ${buildReceiptPrintScript()}
</body>
</html>`;
}

function plainPadLine(left: string, right: string, width = PLAIN_LINE_WIDTH): string {
  const r = right.trim();
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.length > maxLeft ? `${left.slice(0, maxLeft - 1)}.` : left;
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(spaces)}${r}`;
}

function formatPlainReceiptMoney(amount: number): string {
  const formatted = formatReceiptMoney(amount).replace(/\u00a0/g, ' ');
  return formatted;
}

export function buildPlainTextCashRegisterReceipt(
  data: CashRegisterReceiptData,
  paperWidthMm: 58 | 80 = 80,
): string {
  const lineWidth = paperWidthMm === 58 ? 32 : PLAIN_LINE_WIDTH;
  const rule = '-'.repeat(Math.min(lineWidth, PLAIN_LINE_WIDTH));
  const title = data.reportType === 'day_close' ? 'GUN KAPANIS FISI' : 'YONETIME NAKIT DEVRI';
  const subtitle = data.reportType === 'day_close'
    ? 'KASA HAREKETLERI OZETI'
    : 'KASA HAREKETLERI + DEVIR';

  const chronological = [...data.rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const lines: string[] = [
    data.businessName.trim(),
    title,
    subtitle,
    rule,
    `Gun: ${formatBusinessDateLabel(data.businessDateKey)}`,
    `Yazdirma: ${formatReceiptDateTime(data.createdAt)}`,
  ];
  if (data.cashierName?.trim()) {
    lines.push(`Kasiyer: ${data.cashierName.trim()}`);
  }
  lines.push(rule);
  lines.push(plainPadLine('Acilis bakiyesi', formatPlainReceiptMoney(data.openingBalance), lineWidth));
  lines.push(
    plainPadLine(
      'Satis/Iade/Gider/Devir',
      `${data.summary.saleCount}/${data.summary.returnCount}/${data.summary.expenseCount}/${data.summary.handoverCount}`,
      lineWidth,
    ),
  );
  lines.push(plainPadLine('Kapanis bakiyesi', formatPlainReceiptMoney(data.closingBalance), lineWidth));

  if (data.handover) {
    lines.push(rule);
    lines.push(plainPadLine('Devir tutari', formatPlainReceiptMoney(data.handover.amount), lineWidth));
    lines.push(`Alici: ${data.handover.recipient}`);
    if (data.handover.note?.trim()) lines.push(`Not: ${data.handover.note.trim()}`);
  }

  lines.push(rule);
  lines.push('HAREKETLER');
  if (!chronological.length) {
    lines.push('Bu gun icin hareket yok.');
  } else {
    for (const row of chronological) {
      const signed = row.signedAmount >= 0
        ? `+${formatPlainReceiptMoney(row.signedAmount)}`
        : formatPlainReceiptMoney(row.signedAmount);
      const head = `${formatMovementTime(row.createdAt)} ${CASH_ACTIVITY_KIND_LABELS[row.kind]}`;
      lines.push(plainPadLine(head, signed, lineWidth));
      lines.push(
        plainPadLine(
          'Bakiye',
          formatPlainReceiptMoney(row.runningBalance),
          lineWidth,
        ),
      );
      const desc = truncateText(`${row.label}${row.sublabel ? ` · ${row.sublabel}` : ''}`, 44);
      lines.push(`${desc} · ${row.paymentLabel}`);
    }
  }

  lines.push(rule);
  lines.push(
    data.reportType === 'day_close'
      ? 'Gun kapanis kaydi oncesi kasa hareketleri.'
      : 'Yonetime devir kaydi sonrasi kasa hareketleri.',
  );
  lines.push('Bu belge bilgi amaclidir.');

  return toThermalReceiptAscii(lines.join('\n'));
}

function buildFiscalPayload(data: CashRegisterReceiptData) {
  const chronological = [...data.rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return {
    reportType: data.reportType,
    businessDate: data.businessDateKey,
    openingBalance: data.openingBalance,
    closingBalance: data.closingBalance,
    cashierName: data.cashierName,
    handover: data.handover,
    movements: chronological.map((row) => ({
      time: formatMovementTime(row.createdAt),
      kind: CASH_ACTIVITY_KIND_LABELS[row.kind],
      label: row.label,
      amount: row.signedAmount,
      balance: row.runningBalance,
    })),
  };
}

async function tryThermalCashRegisterPrint(
  data: CashRegisterReceiptData,
  printerName: string,
): Promise<PrintCashRegisterReceiptResult | null> {
  const plain = buildPlainTextCashRegisterReceipt(data);
  const rawOk = await tryLimaRawReceiptPrint(plain, printerName);
  if (rawOk) {
    return {
      printed: true,
      fiscal: false,
      thermal: true,
      message: 'Gün sonu fişi yazdırıldı (Zywell)',
    };
  }
  const rawErr = getLastLimaRawPrintError();
  if (rawErr && typeof window !== 'undefined') {
    return {
      printed: false,
      fiscal: false,
      thermal: false,
      message: rawErr,
    };
  }
  return null;
}

export async function printCashRegisterReceipt(
  data: CashRegisterReceiptData,
  options?: PrintCashRegisterReceiptOptions,
): Promise<PrintCashRegisterReceiptResult> {
  let fiscalPrinted = false;
  const printerName =
    options?.windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;

  const thermalFirst = await tryThermalCashRegisterPrint(data, printerName);
  if (thermalFirst?.printed) return thermalFirst;
  if (thermalFirst && !thermalFirst.printed && thermalFirst.message) {
    return thermalFirst;
  }

  if (!options?.skipFiscal) {
    try {
      const fiscal = await printFiscalCashReport(buildFiscalPayload(data));
      if (fiscal.success) {
        fiscalPrinted = isRealFiscalDevicePrint(fiscal);
        if (fiscalPrinted) {
          return {
            printed: true,
            fiscal: true,
            message: fiscal.message ?? 'Kasa fişi yazdırıldı',
          };
        }
      } else if (!options?.skipFiscalConfirm) {
        const proceed = confirm(
          `Yazar kasa fişi gönderilemedi: ${fiscal.message ?? 'Bilinmeyen hata'}\nTermal kasa fişi yazdırılsın mı?`,
        );
        if (!proceed) {
          return { printed: false, fiscal: false, message: fiscal.message };
        }
      }
    } catch {
      if (!options?.skipFiscalConfirm) {
        const proceed = confirm('Yazar kasaya bağlanılamadı.\nTermal kasa fişi yazdırılsın mı?');
        if (!proceed) {
          return { printed: false, fiscal: false, message: 'Yazar kasa bağlantısı yok' };
        }
      }
    }
  }

  await printHtmlReceipt(buildCashRegisterReceiptHtml(data));
  return {
    printed: true,
    fiscal: fiscalPrinted,
    message: 'Kasa fişi yazdırıldı',
  };
}

export function buildCashRegisterReceiptData(params: {
  reportType: CashRegisterReportType;
  businessName: string;
  businessDateKey: string;
  openingBalance: number;
  closingBalance: number;
  rows: CashActivityRow[];
  summary: Pick<CashRegisterSummary, 'saleCount' | 'returnCount' | 'expenseCount' | 'handoverCount'>;
  cashierName?: string;
  handover?: Pick<CashHandover, 'amount' | 'recipient' | 'note' | 'createdAt'>;
}): CashRegisterReceiptData {
  return {
    businessName: params.businessName,
    reportType: params.reportType,
    businessDateKey: params.businessDateKey,
    createdAt: new Date(),
    openingBalance: params.openingBalance,
    closingBalance: params.closingBalance,
    rows: params.rows,
    summary: params.summary,
    cashierName: params.cashierName,
    handover: params.handover,
  };
}
