import type { CartItem, Product } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { PosCheckoutSettings } from '../types/pos';
import { isRealFiscalDevicePrint, printFiscalReceipt } from '../services/fiscalBridge';

export async function tryFiscalReceipt(
  paidItems: CartItem[],
  products: Product[],
  productSets: ProductSet[],
  paymentMethod: 'cash' | 'card' | 'transfer' | 'split' | 'credit',
  total: number,
  settings: PosCheckoutSettings,
): Promise<{ receiptNo?: string; fiscalPrinted: boolean; cancelled: boolean }> {
  const fiscalMethod = paymentMethod === 'split' ? 'card' : paymentMethod;

  const fiscalItems = paidItems.map((item) => {
    if (item.setId) {
      const set = productSets.find((s) => s.id === item.setId);
      return {
        name: set?.name ?? `Set ${item.setId}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: 20,
      };
    }
    const product = products.find((p) => p.id === item.productId);
    return {
      name: product?.name ?? `Ürün #${item.productId}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: 20,
    };
  });

  try {
    const fiscal = await printFiscalReceipt({ items: fiscalItems, paymentMethod: fiscalMethod, total });
    if (fiscal.success) {
      return {
        receiptNo: fiscal.receiptNo,
        fiscalPrinted: isRealFiscalDevicePrint(fiscal),
        cancelled: false,
      };
    }
    if (settings.fiscalFailMode === 'continue') {
      return { fiscalPrinted: false, cancelled: false };
    }
    const ok = confirm(`Yazar kasa hatası: ${fiscal.message}\nSatış yine de kaydedilsin mi?`);
    return { fiscalPrinted: false, cancelled: !ok };
  } catch {
    if (settings.fiscalFailMode === 'continue') {
      return { fiscalPrinted: false, cancelled: false };
    }
    const ok = confirm('Yazar kasaya bağlanılamadı.\nSatış yine de kaydedilsin mi?');
    return { fiscalPrinted: false, cancelled: !ok };
  }
}
