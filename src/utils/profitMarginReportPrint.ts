import type { ProfitMarginReportRow } from './profitMarginReport';
import { formatMarginPercent } from './profitMarginReport';

export interface ProfitMarginReportPrintData {
  businessName: string;
  generatedAt: Date;
  rows: ProfitMarginReportRow[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTry(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} ₺`;
}

function formatDateTimeTr(date: Date): string {
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildProfitMarginReportHtml(data: ProfitMarginReportPrintData): string {
  const tableRows = data.rows.map((row) => {
    const partnerClass = row.partnerMarginPct != null && row.partnerMarginPct < 0 ? 'is-loss' : '';
    const retailClass = row.retailMarginPct != null && row.retailMarginPct < 0 ? 'is-loss' : '';
    return `<tr>
      <td>${escapeHtml(row.productCode)}</td>
      <td class="mono">${escapeHtml(row.barcode || '—')}</td>
      <td>${escapeHtml(row.name)}</td>
      <td class="num">${formatTry(row.purchaseNet)}</td>
      <td class="num">${formatTry(row.partnerNet)}</td>
      <td class="num ${partnerClass}">${formatMarginPercent(row.partnerMarginPct)}</td>
      <td class="num">${formatTry(row.retailNet)}</td>
      <td class="num ${retailClass}">${formatMarginPercent(row.retailMarginPct)}</td>
      <td class="num">${row.stock}</td>
    </tr>`;
  }).join('');

  const avgPartner = averageMargin(data.rows.map((r) => r.partnerMarginPct));
  const avgRetail = averageMargin(data.rows.map((r) => r.retailMarginPct));

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Kar marjı raporu</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 9px;
      color: #111;
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #444; margin-bottom: 10px; font-size: 10px; }
    .summary { margin-bottom: 8px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 5px; vertical-align: top; }
    th {
      background: #f0f9ee;
      color: #1b4332;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    td.num { text-align: right; white-space: nowrap; }
    td.mono { font-family: ui-monospace, monospace; font-size: 8px; }
    tr:nth-child(even) td { background: #fafafa; }
    .is-loss { color: #b91c1c; font-weight: 700; }
    .footer { margin-top: 10px; font-size: 8px; color: #666; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.businessName)} — Kar marjı raporu</h1>
  <div class="meta">
    Oluşturma: ${formatDateTimeTr(data.generatedAt)} · ${data.rows.length} ürün<br />
    Alış: KDV dahil kayıt ÷ 1,20 · Partner / perakende: KDV hariç · Kar % = (satış − alış net) / alış net
  </div>
  <p class="summary">
    Ortalama partner marjı: <strong>${formatMarginPercent(avgPartner)}</strong>
    · Ortalama perakende marjı: <strong>${formatMarginPercent(avgRetail)}</strong>
  </p>
  <table>
    <thead>
      <tr>
        <th>Stok kodu</th>
        <th>Barkod</th>
        <th>Ürün adı</th>
        <th>Alış (KDV hariç)</th>
        <th>Partner (KDV hariç)</th>
        <th>Partner kar %</th>
        <th>Perakende (KDV hariç)</th>
        <th>Perakende kar %</th>
        <th>Stok</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">Ekolojik Market POS — bilgi amaçlı fiyat raporu</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},150);};</script>
</body>
</html>`;
}

function averageMargin(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

export function openProfitMarginReportPrint(data: ProfitMarginReportPrintData): void {
  const html = buildProfitMarginReportHtml(data);
  const printWin = window.open('', 'profit-margin-report-print');
  if (!printWin) {
    window.alert('Yazdırma penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
