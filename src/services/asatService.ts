import type { AsatDebtQueryResult, AsatDiagnostics } from '../types/utilityBillSubscription';

export async function fetchAsatDiagnostics(): Promise<AsatDiagnostics> {
  const response = await fetch('/api/utility-bills/asat/diagnostics', {
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => null) as AsatDiagnostics | null;
  if (!data) {
    return {
      checkedAt: new Date().toISOString(),
      onlinePortalReachable: false,
      mainSiteReachable: false,
      reason: 'NETWORK_UNREACHABLE',
      summary: 'Tanılama yanıtı okunamadı',
      recommendation: 'Manuel Gir kullanın.',
      checks: [],
    };
  }
  return data;
}

function formatDiagnostics(diagnostics?: AsatDiagnostics): string | undefined {
  if (!diagnostics) return undefined;
  const lines = [
    diagnostics.summary,
    ...diagnostics.checks.map((check) => `${check.ok ? '✓' : '✗'} ${check.target}: ${check.detail}`),
    diagnostics.recommendation,
  ];
  return lines.join('\n');
}

export async function fetchAsatDebt(contractNumber: string): Promise<AsatDebtQueryResult> {
  const contract = contractNumber.trim();
  if (!contract) {
    return { ok: false, contractNumber: '', message: 'Sözleşme numarası gerekli' };
  }

  const query = new URLSearchParams({ contract });
  const response = await fetch(`/api/utility-bills/asat?${query.toString()}`, {
    signal: AbortSignal.timeout(25000),
  });

  const data = await response.json().catch(() => null) as AsatDebtQueryResult | null;
  if (!data) {
    return { ok: false, contractNumber: contract, message: 'ASAT yanıtı okunamadı' };
  }

  const resolvedContract = data.contractNumber || data.subscriberNumber || contract;
  return {
    ...data,
    contractNumber: resolvedContract,
    subscriberNumber: resolvedContract,
    message: data.message || (data.ok ? undefined : data.diagnostics?.summary),
    diagnostics: data.diagnostics,
    diagnosticsText: formatDiagnostics(data.diagnostics),
  } as AsatDebtQueryResult & { diagnosticsText?: string };
}
