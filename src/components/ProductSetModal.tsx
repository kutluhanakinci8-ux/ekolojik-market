import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Product, WholesalePrices } from '../types/product';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import { ProductSetPanel } from './ProductSetPanel';
import './ProductSetModal.css';

interface ProductSetModalProps {
  open: boolean;
  products: Product[];
  productSets: ProductSet[];
  onClose: () => void;
  onSave: (data: {
    id?: string;
    stockCode: string;
    name: string;
    description?: string;
    items: ProductSetItem[];
    ourPriceWithVat: number;
    partnerPriceWithVat: number;
    wholesalePrices?: WholesalePrices;
    isActive?: boolean;
  }) => ProductSet | null;
  onAssemble: (setId: string, quantity: number, note?: string) => { ok: boolean; message?: string };
  onAdjustStock: (setId: string, delta: number, note?: string) => void;
  onRemove: (setId: string) => void;
}

export function ProductSetModal({
  open,
  products,
  productSets,
  onClose,
  onSave,
  onAssemble,
  onAdjustStock,
  onRemove,
}: ProductSetModalProps) {
  useEffect(() => {
    if (!open) return;
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="product-set-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="product-set-modal" onClick={(event) => event.stopPropagation()}>
        <header className="product-set-header">
          <div>
            <span className="product-set-kicker">STOK MERKEZİ</span>
            <h2>Ürün Setleri</h2>
          </div>
          <button type="button" className="product-set-close" onClick={onClose} aria-label="Kapat">✕</button>
        </header>
        <ProductSetPanel
          products={products}
          productSets={productSets}
          onSave={onSave}
          onAssemble={onAssemble}
          onAdjustStock={onAdjustStock}
          onRemove={onRemove}
        />
      </div>
    </div>,
    document.body,
  );
}
