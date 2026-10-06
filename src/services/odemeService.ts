export interface OdemePrepareResult {
  ok: boolean;
  sessionId?: string;
  turnstileSiteKey?: string;
  provider?: string;
  message?: string;
}

export interface OdemeDebtResult {
  ok: boolean;
  contractNumber?: string;
  balance?: number;
  dueDate?: string;
  subscriberName?: string;
  message?: string;
  provider?: string;
  needsTurnstile?: boolean;
  noDebt?: boolean;
}

export async function prepareOdemeSession(): Promise<OdemePrepareResult> {
  const response = await fetch('/api/utility-bills/odeme/prepare', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return response.json() as Promise<OdemePrepareResult>;
}

export async function queryOdemeDebt(
  sessionId: string,
  contractNumber: string,
  turnstileToken: string,
): Promise<OdemeDebtResult> {
  const response = await fetch('/api/utility-bills/odeme/query', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      contractNumber,
      turnstileToken,
    }),
  });
  return response.json() as Promise<OdemeDebtResult>;
}
