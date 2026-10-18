export interface FaturaSession {
  ok: boolean;
  sessionId?: string;
  captchaImage?: string;
  message?: string;
}

export interface FaturaQueryResult {
  ok: boolean;
  contractNumber: string;
  balance?: number;
  dueDate?: string;
  message?: string;
  provider?: string;
  noDebt?: boolean;
  captchaError?: boolean;
}

export async function createFaturaSession(): Promise<FaturaSession> {
  const response = await fetch('/api/utility-bills/fatura/session', {
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => null) as FaturaSession | null;
  return data ?? { ok: false, message: 'Oturum başlatılamadı' };
}

export async function queryFaturaDebt(
  sessionId: string,
  contractNumber: string,
  captchaCode: string,
): Promise<FaturaQueryResult> {
  const response = await fetch('/api/utility-bills/fatura/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ sessionId, contractNumber, captchaCode }),
  });
  const data = await response.json().catch(() => null) as FaturaQueryResult | null;
  if (data) return data;
  return {
    ok: false,
    contractNumber,
    message: response.ok ? 'Sorgu yanıtı okunamadı' : `Sunucu hatası (${response.status})`,
  };
}
