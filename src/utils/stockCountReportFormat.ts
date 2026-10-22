import type { StockCountBreakRecord, StockCountReport } from '../types/stockCountReport';

export function formatStockCountReportDateTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatStockCountBreaksPlain(
  breaks: StockCountBreakRecord[] | undefined,
  lineWidth = 48,
): string[] {
  if (!breaks?.length) return [];
  const lines: string[] = ['ARA VERMELER'];
  breaks.forEach((entry, index) => {
    lines.push(`${index + 1}. Ara: ${formatStockCountReportDateTime(entry.pausedAt)}`);
    if (entry.resumedAt) {
      lines.push(`   Devam: ${formatStockCountReportDateTime(entry.resumedAt)}`);
    } else {
      lines.push('   Devam: (bekleniyor)');
    }
  });
  return lines.map((line) => (line.length > lineWidth ? `${line.slice(0, lineWidth - 1)}.` : line));
}

export function stockCountSignatureBlockPlain(report: StockCountReport, lineWidth = 48): string[] {
  const counter = report.countedByDisplayName?.trim() || '—';
  const responsible = report.responsiblePersonName?.trim() || '';
  const rule = '-'.repeat(Math.min(lineWidth, 48));
  return [
    rule,
    'IMZALAR',
    'Sayim yapan:',
    counter.length > lineWidth ? counter.slice(0, lineWidth - 1) : counter,
    'Ad Soyad: _________________________',
    'Imza:     _________________________',
    '',
    'Sorumlu:',
    responsible || '_________________________',
    'Ad Soyad: _________________________',
    'Imza:     _________________________',
  ];
}

export function stockCountHeaderMetaPlain(report: StockCountReport, lineWidth = 48): string[] {
  const counter = report.countedByDisplayName?.trim() || 'Belirtilmedi';
  const ended = report.endedAt ?? report.createdAt;
  const lines = [
    `Sayim yapan: ${counter}`,
    `Baslangic: ${formatStockCountReportDateTime(report.startedAt)}`,
    `Bitis: ${formatStockCountReportDateTime(ended)}`,
  ];
  return lines.map((line) => (line.length > lineWidth ? `${line.slice(0, lineWidth - 1)}.` : line));
}
