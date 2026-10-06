import type { Product } from '../types/product';
import { getCategoryLabel } from '../data/categories';

export function getStockInventoryValue(products: Product[]): number {
  return products.reduce((sum, p) => sum + p.stock * p.partnerPrice, 0);
}

export function getStockHealthPercent(products: Product[]): number {
  if (products.length === 0) return 0;
  const inStock = products.filter((p) => p.stock > 0).length;
  return Math.round((inStock / products.length) * 100);
}

export function exportStockCsv(products: Product[], filename = 'greenleaf-stok.csv') {
  const headers = ['No', 'Kod', 'Kategori', 'Ürün', 'PV', 'Alış', 'Partner', 'Kupon', 'Perakende', 'Bizim KDV', 'Stok', 'Stok Değeri', 'Durum'];
  const rows = products.map((p) => {
    const status = p.stock <= 0 ? 'Tükendi' : p.stock <= 10 ? 'Az Stok' : 'Yeterli';
    const value = p.stock * p.partnerPrice;
    return [
      p.id,
      p.productCode ?? '',
      getCategoryLabel(p.category),
      p.name,
      p.pv,
      p.purchasePrice,
      p.partnerPrice,
      p.couponPrice ?? '',
      p.fullSalePrice,
      p.ourPriceWithVat,
      p.stock,
      value,
      status,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
