export interface StockCountReportLine {
  productId: number;
  systemStock: number;
  scannedQty: number;
  /** Sayım − sistem */
  diff: number;
  appliedAt?: string;
}

/** Oturum kapatıldığında / tekrar açıldığında ara verme kaydı */
export interface StockCountBreakRecord {
  pausedAt: string;
  resumedAt?: string;
}

export interface StockCountReport {
  id: string;
  startedAt: string;
  /** Sayımı bitir (rapor) anı */
  endedAt?: string;
  createdAt: string;
  note: string;
  lines: StockCountReportLine[];
  countedByDisplayName?: string;
  countedByUsername?: string;
  breaks?: StockCountBreakRecord[];
  /** Sorumlu kişi (rapor ekranından, imza satırı için) */
  responsiblePersonName?: string;
  printedAt?: string;
  completedAt?: string;
  /** Kullanıcı sayımdan çıktı — düzeltme uygulanmadı, yeni sayım başlatılabilir */
  abandonedAt?: string;
  /** Okutma devam ediyor — «Sayımı bitir» öncesi arşiv (sunucuya senkron) */
  inProgressAt?: string;
  /** Son kayıtlı sayım fazı (devam için) */
  countPhase?: 'scan' | 'report' | 'apply';
}

export function buildStockCountReportLines(
  lines: Array<{ productId: number; systemStock: number; scannedQty: number }>,
): StockCountReportLine[] {
  return lines.map((line) => ({
    productId: line.productId,
    systemStock: line.systemStock,
    scannedQty: line.scannedQty,
    diff: line.scannedQty - line.systemStock,
  }));
}

export function stockCountReportDiscrepancies(report: StockCountReport): StockCountReportLine[] {
  return report.lines.filter((line) => line.diff !== 0);
}

export function stockCountReportPendingApply(report: StockCountReport): StockCountReportLine[] {
  return stockCountReportDiscrepancies(report).filter((line) => !line.appliedAt);
}

export function isStockCountReportComplete(report: StockCountReport): boolean {
  if (report.abandonedAt) return true;
  return stockCountReportPendingApply(report).length === 0;
}

export function isStockCountReportAbandoned(report: StockCountReport): boolean {
  return Boolean(report.abandonedAt);
}

export function isStockCountReportInProgress(report: StockCountReport): boolean {
  return Boolean(report.inProgressAt) && !report.endedAt && !report.abandonedAt && !report.completedAt;
}

export function newStockCountReportId(): string {
  return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
