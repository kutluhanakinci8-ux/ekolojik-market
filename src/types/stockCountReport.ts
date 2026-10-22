export interface StockCountReportLine {
  productId: number;
  systemStock: number;
  scannedQty: number;
  /** Sayım − sistem */
  diff: number;
  appliedAt?: string;
}

export interface StockCountReport {
  id: string;
  startedAt: string;
  createdAt: string;
  note: string;
  lines: StockCountReportLine[];
  printedAt?: string;
  completedAt?: string;
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
  return stockCountReportPendingApply(report).length === 0;
}

export function newStockCountReportId(): string {
  return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
