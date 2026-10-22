import type { StockCountSessionDraft } from '../storage/stockCountSession';
import {
  isStockCountReportInProgress,
  stockCountReportPendingApply,
  type StockCountReport,
} from '../types/stockCountReport';

export type ResumableStockCountSession = {
  reportId: string;
  startedAt: string;
  lineCount: number;
  scanTotal: number;
  phase: 'scan' | 'report' | 'apply';
  statusLabel: string;
  source: 'archive' | 'device';
};

export function isStockCountReportResumable(report: StockCountReport): boolean {
  if (report.abandonedAt) return false;
  if (report.completedAt && stockCountReportPendingApply(report).length === 0) {
    return false;
  }
  return (report.lines?.length ?? 0) > 0;
}

export function inferStockCountPhase(report: StockCountReport): 'scan' | 'report' | 'apply' {
  if (report.countPhase) return report.countPhase;
  if (!report.endedAt) return 'scan';
  if (report.printedAt && stockCountReportPendingApply(report).length > 0) return 'apply';
  if (report.endedAt) return 'report';
  return 'scan';
}

function phaseStatusLabel(phase: 'scan' | 'report' | 'apply', report: StockCountReport): string {
  if (isStockCountReportInProgress(report)) return 'Okutma sürüyor';
  if (phase === 'apply') return 'Düzeltme bekliyor';
  if (phase === 'report') return report.printedAt ? 'Rapor yazıldı' : 'Rapor bekliyor';
  return 'Okutma';
}

export function stockCountReportToSessionDraft(report: StockCountReport): StockCountSessionDraft {
  const countLines: StockCountSessionDraft['countLines'] = {};
  for (const line of report.lines) {
    countLines[line.productId] = {
      productId: line.productId,
      systemStock: line.systemStock,
      scannedQty: line.scannedQty,
    };
  }
  const lastLine = report.lines[report.lines.length - 1];
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    startedAt: report.startedAt,
    countPhase: inferStockCountPhase(report),
    countLines,
    countLastProductId: lastLine?.productId ?? null,
    note: report.note ?? '',
    reportId: report.id,
    countedByDisplayName: report.countedByDisplayName,
    countedByUsername: report.countedByUsername,
    breaks: report.breaks,
    responsiblePersonName: report.responsiblePersonName,
    endedAt: report.endedAt,
  };
}

export function listResumableStockCountSessions(
  reports: StockCountReport[],
  localDraft: StockCountSessionDraft | null,
): ResumableStockCountSession[] {
  const map = new Map<string, ResumableStockCountSession>();

  for (const report of reports) {
    if (!isStockCountReportResumable(report)) continue;
    const phase = inferStockCountPhase(report);
    const scanTotal = report.lines.reduce((sum, line) => sum + line.scannedQty, 0);
    map.set(report.id, {
      reportId: report.id,
      startedAt: report.startedAt,
      lineCount: report.lines.length,
      scanTotal,
      phase,
      statusLabel: phaseStatusLabel(phase, report),
      source: 'archive',
    });
  }

  if (localDraft && Object.keys(localDraft.countLines).length > 0) {
    const reportId = localDraft.reportId ?? `local-${localDraft.startedAt}`;
    const scanTotal = Object.values(localDraft.countLines).reduce((s, l) => s + l.scannedQty, 0);
    const archived = localDraft.reportId
      ? reports.find((r) => r.id === localDraft.reportId)
      : undefined;
    const phase = localDraft.countPhase;
    map.set(reportId, {
      reportId,
      startedAt: localDraft.startedAt,
      lineCount: Object.keys(localDraft.countLines).length,
      scanTotal,
      phase,
      statusLabel: archived
        ? phaseStatusLabel(phase, archived)
        : phase === 'scan'
          ? 'Bu cihazda kayıtlı'
          : phase === 'apply'
            ? 'Düzeltme'
            : 'Rapor',
      source: 'device',
    });
  }

  return [...map.values()].sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );
}
