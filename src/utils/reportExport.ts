/** CSV export helpers for accounting reports */

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportProfitLossCsv(
  report: {
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    expenseByCategory: { label: string; total: number }[];
  },
  periodLabel: string,
): void {
  const rows: (string | number)[][] = [
    ['Net Satışlar', report.netRevenue],
    ['Satılan Malın Maliyeti (COGS)', report.cogs],
    ['Brüt Kâr', report.grossProfit],
    ['Faaliyet Giderleri', report.operatingExpenses],
    ['Net Kâr', report.netProfit],
    [],
    ...report.expenseByCategory.map((row) => [row.label, row.total]),
  ];
  downloadCsv(`gelir-tablosu-${periodLabel}.csv`, ['Kalem', 'Tutar (₺)'], rows);
}

export function exportCustomerLedgerCsv(
  rows: { customerName: string; balance: number; overdueBalance: number }[],
): void {
  downloadCsv(
    'musteri-cari.csv',
    ['Müşteri', 'Bakiye', 'Vadesi Geçen'],
    rows.map((row) => [row.customerName, row.balance, row.overdueBalance]),
  );
}

export function exportCustomerPeriodSalesCsv(
  rows: {
    customerName: string;
    saleCount: number;
    creditSaleCount: number;
    periodTotal: number;
  }[],
  periodLabel: string,
): void {
  const safeLabel = periodLabel.replace(/\s+/g, '-').toLowerCase();
  downloadCsv(
    `musteri-donem-satis-${safeLabel}.csv`,
    ['Müşteri', 'Satış adedi', 'Veresiye adedi', 'Dönem tutarı (₺)'],
    rows.map((row) => [row.customerName, row.saleCount, row.creditSaleCount, row.periodTotal]),
  );
}

export function exportSupplierLedgerCsv(
  rows: { supplierName: string; balance: number; overdueBalance: number }[],
): void {
  downloadCsv(
    'tedarikci-cari.csv',
    ['Tedarikçi', 'Borç', 'Vadesi Geçen'],
    rows.map((row) => [row.supplierName, row.balance, row.overdueBalance]),
  );
}
