/**
 * InPOS M530 — yerel kasa köprüsü istemcisi
 * Kasa PC'de inpos-bridge servisi çalışmalı (varsayılan http://127.0.0.1:9191)
 */

import type { PriceType } from '../types/product';

export interface FiscalReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface FiscalReceiptRequest {
  items: FiscalReceiptItem[];
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit';
  total: number;
}

export interface FiscalReceiptResponse {
  success: boolean;
  receiptNo?: string;
  message?: string;
  simulated?: boolean;
}

export interface FiscalReturnReceiptItem extends FiscalReceiptItem {
  priceType?: PriceType;
}

export interface FiscalReturnReceiptRequest {
  originalSaleId: string;
  returnId: string;
  items: FiscalReturnReceiptItem[];
  refundMethod: FiscalReceiptRequest['paymentMethod'];
  refundTotal: number;
  reason?: string;
  note?: string;
}

export interface FiscalReturnReceiptResponse extends FiscalReceiptResponse {
  documentType?: 'return';
}

const BRIDGE_URL = import.meta.env.VITE_FISCAL_BRIDGE_URL || 'http://127.0.0.1:9191';

export async function checkFiscalBridge(): Promise<{ online: boolean; device?: string; message?: string }> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { online: false, message: 'Köprü yanıt vermedi' };
    const data = await res.json();
    return { online: true, device: data.device, message: data.message };
  } catch {
    return { online: false, message: 'Kasa köprüsü kapalı (Windows PC gerekli)' };
  }
}

export async function printFiscalReceipt(req: FiscalReceiptRequest): Promise<FiscalReceiptResponse> {
  const res = await fetch(`${BRIDGE_URL}/api/fiscal/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return res.json() as Promise<FiscalReceiptResponse>;
}

/** İade / iptal fişi — InPOS köprüsü üzerinden mali iade belgesi */
export async function printFiscalReturnReceipt(
  req: FiscalReturnReceiptRequest,
): Promise<FiscalReturnReceiptResponse> {
  const res = await fetch(`${BRIDGE_URL}/api/fiscal/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return res.json() as Promise<FiscalReturnReceiptResponse>;
}

export const PAYMENT_TO_INPOS: Record<FiscalReceiptRequest['paymentMethod'], string> = {
  cash: 'Nakit',
  card: 'Kredi Kartı',
  transfer: 'Havale/EFT',
  credit: 'Veresiye',
};

export interface FiscalCashReportMovement {
  time: string;
  kind: string;
  label: string;
  amount: number;
  balance: number;
}

export interface FiscalCashReportRequest {
  reportType: 'day_close' | 'handover';
  businessDate: string;
  openingBalance: number;
  closingBalance: number;
  cashierName?: string;
  handover?: {
    amount: number;
    recipient: string;
    note?: string;
  };
  movements: FiscalCashReportMovement[];
}

export async function printFiscalCashReport(
  req: FiscalCashReportRequest,
): Promise<FiscalReceiptResponse> {
  const res = await fetch(`${BRIDGE_URL}/api/fiscal/cash-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return res.json() as Promise<FiscalReceiptResponse>;
}
