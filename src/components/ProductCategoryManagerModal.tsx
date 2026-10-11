import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppSettings, ProductCategoryDef } from '../types/business';
import {
  createProductCategoryId,
  resolveProductCategoryCatalog,
  validateProductCategoryLabel,
} from '../utils/productCategories';
import './ProductCategoryManagerModal.css';

interface ProductCategoryManagerModalProps {
  open: boolean;
  settings: AppSettings;
  productCounts: Record<string, number>;
  onClose: () => void;
  onSave: (
    catalog: ProductCategoryDef[],
    reassignments: Record<string, string>,
  ) => { ok: boolean; message?: string };
}

type DraftRow = ProductCategoryDef & { isNew?: boolean };

export function ProductCategoryManagerModal({
  open,
  settings,
  productCounts,
  onClose,
  onSave,
}: ProductCategoryManagerModalProps) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reassignFrom, setReassignFrom] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignments, setReassignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setRows(resolveProductCategoryCatalog(settings).map((c) => ({ ...c })));
    setError(null);
    setReassignFrom(null);
    setReassignTo('');
    setReassignments({});
  }, [open, settings]);

  const existingIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const updateRow = (id: string, patch: Partial<Pick<ProductCategoryDef, 'label' | 'icon'>>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setError(null);
  };

  const addRow = () => {
    const label = 'Yeni kategori';
    const id = createProductCategoryId(label, existingIds);
    setRows((prev) => [...prev, { id, label, icon: '🏷️', isNew: true }]);
    setError(null);
  };

  const requestRemove = (id: string) => {
    const count = productCounts[id] ?? 0;
    if (count === 0) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setError(null);
      return;
    }
    const others = rows.filter((r) => r.id !== id);
    if (others.length === 0) {
      setError('Son kategori silinemez.');
      return;
    }
    setReassignFrom(id);
    setReassignTo(others[0]?.id ?? '');
    setError(null);
  };

  const confirmRemoveWithReassign = () => {
    if (!reassignFrom || !reassignTo || reassignFrom === reassignTo) {
      setError('Ürünlerin taşınacağı kategoriyi seçin.');
      return;
    }
    setReassignments((prev) => ({ ...prev, [reassignFrom]: reassignTo }));
    setRows((prev) => prev.filter((r) => r.id !== reassignFrom));
    setReassignFrom(null);
    setError(null);
  };

  const handleSave = () => {
    const catalog: ProductCategoryDef[] = [];
    for (const row of rows) {
      const labelErr = validateProductCategoryLabel(row.label, catalog, row.id);
      if (labelErr) {
        setError(labelErr);
        return;
      }
      catalog.push({
        id: row.id,
        label: row.label.trim(),
        icon: (row.icon ?? '🏷️').trim() || '🏷️',
      });
    }
    if (catalog.length === 0) {
      setError('En az bir kategori gerekli.');
      return;
    }

    if (reassignFrom) {
      setError('Silinecek kategori için önce ürünleri taşıyın.');
      return;
    }

    const result = onSave(catalog, reassignments);
    if (!result.ok) {
      setError(result.message ?? 'Kaydedilemedi.');
      return;
    }
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="product-cat-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="product-cat-modal"
        role="dialog"
        aria-labelledby="product-cat-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="product-cat-modal__head">
          <div>
            <h2 id="product-cat-modal-title">Ürün kategorileri</h2>
            <p>İsim ve simgeyi düzenleyin; satış ve stok filtreleri buradan güncellenir.</p>
          </div>
          <button type="button" className="product-cat-modal__close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </header>

        <ul className="product-cat-modal__list">
          {rows.map((row) => (
            <li key={row.id} className="product-cat-modal__row">
              <input
                type="text"
                className="product-cat-modal__icon"
                value={row.icon}
                maxLength={4}
                aria-label="Simge"
                onChange={(e) => updateRow(row.id, { icon: e.target.value })}
              />
              <input
                type="text"
                className="product-cat-modal__label"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
              />
              <span className="product-cat-modal__count" title="Bu kategorideki ürün sayısı">
                {productCounts[row.id] ?? 0} ürün
              </span>
              <button
                type="button"
                className="product-cat-modal__remove"
                onClick={() => requestRemove(row.id)}
                disabled={rows.length <= 1}
                title="Kategoriyi sil"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-outline product-cat-modal__add" onClick={addRow}>
          ＋ Yeni kategori
        </button>

        {reassignFrom && (
          <div className="product-cat-modal__reassign">
            <p>
              <strong>{productCounts[reassignFrom] ?? 0}</strong> ürün bu kategoride. Silmeden önce taşıyın:
            </p>
            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              {rows
                .filter((r) => r.id !== reassignFrom)
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
            </select>
            <button type="button" className="btn btn-outline" onClick={confirmRemoveWithReassign}>
              Taşı ve sil
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setReassignFrom(null)}>
              İptal
            </button>
          </div>
        )}

        {error && <p className="product-cat-modal__error" role="alert">{error}</p>}

        <footer className="product-cat-modal__footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Kaydet</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
