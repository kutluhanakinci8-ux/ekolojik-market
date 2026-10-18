import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { Supplier } from '../types/accounting';
import {
  getSupplierBalance,
  getSupplierLedgerTotals,
  getSupplierOverdueBalance,
  type LedgerDebitCreditTotals,
} from '../utils/accountingAnalytics';
import { formatCurrency } from '../utils/format';
import { getSupplierPurchaseSummary } from '../utils/supplierPurchases';
import { supplierMatchesSearch, validateSupplierInput } from '../utils/supplierSearch';
import { SupplierStatementPanel } from './SupplierStatementPanel';

interface SuppliersScreenProps {
  store: Store;
  embedded?: boolean;
}

const EMPTY_FORM = {
  name: '',
  taxNumber: '',
  taxOffice: '',
  phone: '',
  email: '',
  address: '',
  paymentTermDays: '30',
  notes: '',
};

type FormMode = 'new' | 'edit' | null;

function getSupplierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatLedgerColumnAmount(value: number): string {
  return value > 0 ? formatCurrency(value) : '—';
}

function formatPayableBalance(balance: number): { label: string; className: string } {
  if (balance > 0) {
    return { label: formatCurrency(balance), className: 'customer-balance--debt' };
  }
  if (balance < 0) {
    return { label: formatCurrency(balance), className: 'customer-balance--overpaid' };
  }
  return { label: formatCurrency(0), className: 'customer-balance--clear' };
}

function SupplierDetailPanel({
  supplier,
  ledgerBalance,
  overdueBalance,
  purchaseSummary,
  supplierLedger,
  onEdit,
  onDelete,
  onClose,
}: {
  supplier: Supplier;
  ledgerBalance: number;
  overdueBalance: number;
  purchaseSummary: ReturnType<typeof getSupplierPurchaseSummary>;
  supplierLedger: Store['supplierLedger'];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const balanceDisplay = formatPayableBalance(ledgerBalance);
  const ledgerTotals = useMemo(
    () => getSupplierLedgerTotals(supplierLedger.filter((entry) => entry.supplierId === supplier.id)),
    [supplier.id, supplierLedger],
  );
  return (
    <div className="customer-detail-panel customer-detail-panel--premium supplier-detail-panel">
      <div className="customer-detail-toolbar">
        <button type="button" className="customer-detail-back" onClick={onClose}>
          ← Listeye Dön
        </button>
        <div className="customer-detail-toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>
            Düzenle
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
            Sil
          </button>
        </div>
      </div>

      <div className="customer-detail-profile">
        <div className="customer-premium-avatar customer-premium-avatar--lg" aria-hidden="true">
          {getSupplierInitials(supplier.name)}
        </div>
        <div className="customer-detail-profile-text">
          <h2>{supplier.name}</h2>
          {supplier.taxOffice && (
            <p className="customer-detail-profile-meta">
              <span>{supplier.taxOffice}</span>
            </p>
          )}
        </div>
      </div>

      <div className="customer-detail-hero">
        <div className="customer-detail-kpis">
          <div className="customer-detail-kpi">
            <span>Toplam borç</span>
            <strong>{formatLedgerColumnAmount(ledgerTotals.debit)}</strong>
          </div>
          <div className="customer-detail-kpi">
            <span>Toplam alacak</span>
            <strong>{formatLedgerColumnAmount(ledgerTotals.credit)}</strong>
          </div>
          <div className="customer-detail-kpi customer-detail-kpi--balance">
            <span>Cari borç</span>
            <strong className={balanceDisplay.className}>{balanceDisplay.label}</strong>
          </div>
          {overdueBalance > 0 && (
            <div className="customer-detail-kpi customer-detail-kpi--balance">
              <span>Vadesi geçen</span>
              <strong className="customer-balance--debt">{formatCurrency(overdueBalance)}</strong>
            </div>
          )}
          <div className="customer-detail-kpi">
            <span>Alış faturası</span>
            <strong>{purchaseSummary.invoiceCount}</strong>
          </div>
          <div className="customer-detail-kpi">
            <span>Alış toplamı</span>
            <strong>{purchaseSummary.totalGross > 0 ? formatCurrency(purchaseSummary.totalGross) : '—'}</strong>
          </div>
        </div>

        <div className="customer-detail-info-strip">
          <div className="customer-info-pill">
            <small>VKN</small>
            <strong>{supplier.taxNumber || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>Vergi dairesi</small>
            <strong>{supplier.taxOffice || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>Telefon</small>
            <strong>{supplier.phone || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>E-posta</small>
            <strong>{supplier.email || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>Ödeme vadesi</small>
            <strong>{supplier.paymentTermDays ? `${supplier.paymentTermDays} gün` : '—'}</strong>
          </div>
          <div className="customer-info-pill customer-info-pill--wide">
            <small>Adres</small>
            <strong>{supplier.address || '—'}</strong>
          </div>
        </div>

        {supplier.notes && (
          <p className="customer-detail-note">
            <strong>Not:</strong> {supplier.notes}
          </p>
        )}
      </div>

      <SupplierStatementPanel
        supplierId={supplier.id}
        supplierName={supplier.name}
        ledger={supplierLedger}
        className="supplier-detail-statement"
      />
    </div>
  );
}

export function SuppliersScreen({ store, embedded = false }: SuppliersScreenProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return store.suppliers;
    return store.suppliers.filter((supplier) => supplierMatchesSearch(supplier, q));
  }, [store.suppliers, search]);

  const supplierBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const supplier of store.suppliers) {
      const entries = store.supplierLedger.filter((entry) => entry.supplierId === supplier.id);
      map.set(supplier.id, getSupplierBalance(entries));
    }
    return map;
  }, [store.suppliers, store.supplierLedger]);

  const supplierLedgerTotals = useMemo(() => {
    const map = new Map<string, LedgerDebitCreditTotals>();
    for (const supplier of store.suppliers) {
      const entries = store.supplierLedger.filter((entry) => entry.supplierId === supplier.id);
      map.set(supplier.id, getSupplierLedgerTotals(entries));
    }
    return map;
  }, [store.suppliers, store.supplierLedger]);

  const supplierOverdue = useMemo(() => {
    const map = new Map<string, number>();
    for (const supplier of store.suppliers) {
      const entries = store.supplierLedger.filter((entry) => entry.supplierId === supplier.id);
      map.set(supplier.id, getSupplierOverdueBalance(entries));
    }
    return map;
  }, [store.suppliers, store.supplierLedger]);

  const purchaseSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSupplierPurchaseSummary>>();
    for (const supplier of store.suppliers) {
      map.set(supplier.id, getSupplierPurchaseSummary(supplier.id, store.purchaseInvoices));
    }
    return map;
  }, [store.suppliers, store.purchaseInvoices]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormMode('new');
    setError(null);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      taxNumber: supplier.taxNumber ?? '',
      taxOffice: supplier.taxOffice ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      paymentTermDays: supplier.paymentTermDays ? String(supplier.paymentTermDays) : '30',
      notes: supplier.notes ?? '',
    });
    setFormMode('edit');
    setError(null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = () => {
    const paymentTermDays = parseInt(form.paymentTermDays, 10);
    const payload = {
      name: form.name.trim(),
      taxNumber: form.taxNumber.trim() || undefined,
      taxOffice: form.taxOffice.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      paymentTermDays: Number.isNaN(paymentTermDays) ? undefined : Math.max(0, paymentTermDays),
      notes: form.notes.trim() || undefined,
    };

    const validationError = validateSupplierInput(payload, {
      existingSuppliers: store.suppliers,
      editingId: editingId ?? undefined,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingId) {
      store.updateSupplier(editingId, payload);
      showToast('Tedarikçi güncellendi');
    } else {
      const supplier = store.addSupplier(payload);
      setSelectedId(supplier.id);
      showToast('Tedarikçi eklendi');
    }
    closeForm();
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedId((prev) => (prev === supplierId ? null : supplierId));
  };

  const closeSupplier = () => setSelectedId(null);

  const handleDelete = (supplier: Supplier) => {
    if (!window.confirm(`${supplier.name} tedarikçisini silmek istediğinize emin misiniz?`)) return;
    store.removeSupplier(supplier.id);
    if (selectedId === supplier.id) setSelectedId(null);
    showToast('Tedarikçi silindi');
  };

  const selectedSupplier = selectedId
    ? store.suppliers.find((item) => item.id === selectedId) ?? null
    : null;

  return (
    <div className={`module-screen customer-screen--premium supplier-screen--premium ${embedded ? 'customer-screen--embedded' : ''}`}>
      <header className="module-header customer-page-header customer-page-header--unified">
        <div className="customer-page-intro">
          {!embedded && <h1>Tedarikçiler</h1>}
          <p className="customer-page-meta">
            {store.suppliers.length} kayıtlı tedarikçi · cari borç ve alış faturaları
          </p>
        </div>

        <div className="search-box customer-premium-search">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder="Firma adı, VKN, vergi dairesi, telefon, e-posta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="customer-page-actions">
          <span className="customer-premium-count">{filtered.length} tedarikçi</span>
          <div className="customer-view-toggle" role="group" aria-label="Görünüm">
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
            >
              ⊞ Kart
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              ≡ Liste
            </button>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNewForm}>
            + Yeni
          </button>
        </div>
      </header>

      {toast && <div className="sale-toast" role="status">✓ {toast}</div>}

      {filtered.length === 0 ? (
        <div className="customer-premium-empty module-card">
          <p className="module-empty">
            {store.suppliers.length === 0
              ? 'Henüz tedarikçi kaydı yok. «+ Yeni» ile ekleyin veya örnek veriyi alış faturalarından yükleyin.'
              : 'Aramanızla eşleşen tedarikçi bulunamadı.'}
          </p>
        </div>
      ) : (
        <div className={`customer-browser ${selectedId ? 'customer-browser--detail' : ''}`}>
          <div className="customer-browser-list">
            {viewMode === 'cards' ? (
              <ul className="customer-premium-grid">
                {filtered.map((supplier) => {
                  const isSelected = selectedId === supplier.id;
                  const ledgerBalance = supplierBalances.get(supplier.id) ?? 0;
                  const balanceDisplay = formatPayableBalance(ledgerBalance);
                  const summary = purchaseSummaries.get(supplier.id)!;

                  return (
                    <li key={supplier.id} className={`customer-premium-item ${isSelected ? 'selected' : ''}`}>
                      <article className="customer-premium-card">
                        <div className="customer-premium-card-body">
                          <div className="customer-premium-card-head">
                            <div className="customer-premium-avatar" aria-hidden="true">
                              {getSupplierInitials(supplier.name)}
                            </div>
                            <div className="customer-premium-title">
                              <div className="customer-premium-name-row">
                                <strong>{supplier.name}</strong>
                              </div>
                              <div className="customer-premium-subline">
                                {supplier.taxNumber && <span className="customer-premium-gl">{supplier.taxNumber}</span>}
                                {supplier.phone && <span>{supplier.phone}</span>}
                              </div>
                            </div>
                            <div className="customer-premium-head-stats">
                              {summary.invoiceCount > 0 && (
                                <span className="customer-sale-badge">{summary.invoiceCount} alış</span>
                              )}
                              <span className={`customer-balance-badge ${balanceDisplay.className}`}>
                                Borç {balanceDisplay.label}
                              </span>
                              {summary.totalGross > 0 && (
                                <span className="customer-spend-badge">Alış {formatCurrency(summary.totalGross)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="customer-premium-card-footer" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditForm(supplier)}>
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm customer-premium-expand"
                            onClick={() => toggleSupplier(supplier.id)}
                          >
                            {isSelected ? 'Kapat' : 'Detay'}
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="module-card module-card--flush customer-list-table-wrap supplier-list-table-wrap">
                <table className={`module-table customer-list-table ${selectedId ? 'supplier-list-table--detail-open' : ''}`}>
                  <thead>
                    <tr>
                      <th className="supplier-list-col-name">Tedarikçi</th>
                      <th className="supplier-list-col-vkn">VKN</th>
                      <th className="supplier-list-col-phone">Telefon</th>
                      <th className="supplier-list-col-compact-hide">Alış</th>
                      <th className="customer-list-col-num supplier-list-col-compact-hide">Borç</th>
                      <th className="customer-list-col-num supplier-list-col-compact-hide">Alacak</th>
                      <th className="customer-list-col-num">Cari Borç</th>
                      <th className="customer-list-col-num supplier-list-col-compact-hide">Alış Toplamı</th>
                      <th>Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((supplier) => {
                      const isSelected = selectedId === supplier.id;
                      const ledgerBalance = supplierBalances.get(supplier.id) ?? 0;
                      const ledgerTotals = supplierLedgerTotals.get(supplier.id)!;
                      const balanceDisplay = formatPayableBalance(ledgerBalance);
                      const summary = purchaseSummaries.get(supplier.id)!;
                      const handleCellToggle = () => toggleSupplier(supplier.id);

                      return (
                        <tr key={supplier.id} className={isSelected ? 'selected' : ''}>
                          <td
                            className="customer-list-cell"
                            onClick={handleCellToggle}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            <div className="customer-list-row-name">
                              <span className="customer-list-row-avatar" aria-hidden="true">
                                {getSupplierInitials(supplier.name)}
                              </span>
                              <strong>{supplier.name}</strong>
                            </div>
                          </td>
                          <td className="customer-list-cell mono supplier-list-col-vkn" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {supplier.taxNumber ?? '—'}
                          </td>
                          <td className="customer-list-cell supplier-list-col-phone" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {supplier.phone ?? '—'}
                          </td>
                          <td className="customer-list-cell supplier-list-col-compact-hide" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {summary.invoiceCount > 0 ? `${summary.invoiceCount} alış` : '—'}
                          </td>
                          <td className="customer-list-cell customer-list-col-num customer-list-cell--muted supplier-list-col-compact-hide" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {formatLedgerColumnAmount(ledgerTotals.debit)}
                          </td>
                          <td className="customer-list-cell customer-list-col-num customer-list-cell--muted supplier-list-col-compact-hide" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {formatLedgerColumnAmount(ledgerTotals.credit)}
                          </td>
                          <td className="customer-list-cell customer-list-col-num" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            <strong className={balanceDisplay.className}>{balanceDisplay.label}</strong>
                          </td>
                          <td className="customer-list-cell customer-list-cell--muted customer-list-col-num supplier-list-col-compact-hide" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                            {summary.totalGross > 0 ? formatCurrency(summary.totalGross) : '—'}
                          </td>
                          <td className="customer-list-cell customer-list-cell--action">
                            <button
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                              onClick={handleCellToggle}
                            >
                              {isSelected ? 'Kapat' : 'Detay'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedSupplier && (
            <aside className="customer-browser-detail">
              <SupplierDetailPanel
                supplier={selectedSupplier}
                ledgerBalance={supplierBalances.get(selectedSupplier.id) ?? 0}
                overdueBalance={supplierOverdue.get(selectedSupplier.id) ?? 0}
                purchaseSummary={purchaseSummaries.get(selectedSupplier.id)!}
                supplierLedger={store.supplierLedger}
                onEdit={() => openEditForm(selectedSupplier)}
                onDelete={() => handleDelete(selectedSupplier)}
                onClose={closeSupplier}
              />
            </aside>
          )}
        </div>
      )}

      {formMode && (
        <div className="customer-modal-backdrop" role="presentation" onClick={closeForm}>
          <div
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-form-head">
              <h2 id="supplier-form-title">{formMode === 'edit' ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} aria-label="Kapat">
                ✕
              </button>
            </div>

            <div className="customer-form-grid module-form">
              <label className="customer-form-span2">
                Firma Adı <em className="req">*</em>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Tedarikçi ünvanı" />
              </label>
              <label>
                Vergi No (VKN)
                <input value={form.taxNumber} onChange={(e) => setField('taxNumber', e.target.value)} placeholder="10 veya 11 hane" />
              </label>
              <label>
                Vergi Dairesi
                <input value={form.taxOffice} onChange={(e) => setField('taxOffice', e.target.value)} />
              </label>
              <label>
                Telefon
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+90 …" />
              </label>
              <label>
                E-posta
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </label>
              <label className="customer-form-span2">
                Adres
                <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
              </label>
              <label>
                Ödeme vadesi (gün)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.paymentTermDays}
                  onChange={(e) => setField('paymentTermDays', e.target.value)}
                />
              </label>
              <label className="customer-form-span2">
                Not
                <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={3} />
              </label>
            </div>

            {error && <p className="customer-form-error" role="alert">{error}</p>}

            <div className="customer-form-actions">
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {formMode === 'edit' ? 'Güncelle' : 'Tedarikçi Ekle'}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeForm}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
