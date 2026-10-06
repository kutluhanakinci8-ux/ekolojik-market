import { printFiscalReturnReceipt } from '../services/fiscalBridge';
import type { Product, Sale } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { SaleReturn } from '../types/saleReturn';
import {
  buildReturnReceipt,
  printReturnReceipt,
  type ReturnReceiptData,
} from './receiptPrint';

export interface PrintReturnReceiptInput {
  businessName: string;
  sale: Sale;
  returnRecord: SaleReturn;
  products: Product[];
  productSets: ProductSet[];
}

export interface PrintReturnReceiptResult {
  printed: boolean;
  fiscal: boolean;
  receiptNo?: string;
  message?: string;
}

function resolveReturnLineName(
  line: SaleReturn['items'][number],
  products: Product[],
  productSets: ProductSet[],
): string {
  if (line.setId) {
    return productSets.find((set) => set.id === line.setId)?.name ?? `Set ${line.setId}`;
  }
  return products.find((product) => product.id === line.productId)?.name ?? `Ürün #${line.productId}`;
}

export function buildReturnReceiptPayload(input: PrintReturnReceiptInput): ReturnReceiptData {
  const { businessName, sale, returnRecord, products, productSets } = input;
  return buildReturnReceipt(
    returnRecord,
    sale,
    products,
    productSets,
    businessName,
    { createdAt: new Date(returnRecord.createdAt) },
  );
}

/**
 * İade işlemi sonrası mali yazıcı (InPOS köprüsü) veya termal yedek fiş yazdırır.
 */
export async function printSaleReturnReceipt(
  input: PrintReturnReceiptInput,
  options?: { skipFiscalConfirm?: boolean },
): Promise<PrintReturnReceiptResult> {
  const { sale, returnRecord, products, productSets } = input;

  if (returnRecord.items.length === 0) {
    return { printed: false, fiscal: false, message: 'İade kalemi yok' };
  }

  const fiscalItems = returnRecord.items.map((line) => ({
    name: resolveReturnLineName(line, products, productSets),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    vatRate: 20,
    priceType: line.priceType,
  }));

  let fiscalReceiptNo: string | undefined;
  let fiscalPrinted = false;

  if (returnRecord.refundTotal > 0 || returnRecord.items.some((line) => line.priceType === 'sample')) {
    try {
      const fiscal = await printFiscalReturnReceipt({
        originalSaleId: sale.id,
        returnId: returnRecord.id,
        items: fiscalItems,
        refundMethod: returnRecord.refundMethod,
        refundTotal: returnRecord.refundTotal,
        reason: returnRecord.reason,
        note: returnRecord.note,
      });

      if (fiscal.success) {
        fiscalPrinted = !fiscal.simulated;
        fiscalReceiptNo = fiscal.receiptNo;
      } else if (!options?.skipFiscalConfirm && !confirm(
        `Yazar kasa iade fişi hatası: ${fiscal.message ?? 'Bilinmeyen hata'}\nTermal iade fişi yazdırılsın mı?`,
      )) {
        return { printed: false, fiscal: false, message: fiscal.message };
      }
    } catch {
      if (!options?.skipFiscalConfirm && !confirm('Yazar kasaya bağlanılamadı.\nTermal iade fişi yazdırılsın mı?')) {
        return { printed: false, fiscal: false, message: 'Yazar kasa bağlantısı yok' };
      }
    }
  }

  if (!fiscalPrinted) {
    const receiptData = buildReturnReceiptPayload(input);
    await printReturnReceipt(receiptData);
    return {
      printed: true,
      fiscal: false,
      receiptNo: returnRecord.id,
      message: 'Termal iade fişi yazdırıldı',
    };
  }

  return {
    printed: true,
    fiscal: true,
    receiptNo: fiscalReceiptNo ?? returnRecord.id,
    message: 'Mali iade fişi kesildi',
  };
}

export function formatReturnReceiptToastMessage(
  returnId: string,
  printResult: PrintReturnReceiptResult,
): string {
  if (!printResult.printed) {
    return `İade tamamlandı — ${returnId} (fiş yazdırılamadı)`;
  }
  if (printResult.fiscal && printResult.receiptNo) {
    return `İade tamamlandı — ${returnId} · Mali iade fişi: ${printResult.receiptNo}`;
  }
  return `İade tamamlandı — ${returnId} · İade fişi yazdırıldı`;
}
