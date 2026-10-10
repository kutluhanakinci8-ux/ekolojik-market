import { useEffect, useRef, useState } from 'react';
import { APP_CATALOG_VERSION, EXPECTED_PRODUCT_COUNT } from '../data/appVersion';
import { PRICE_CATALOG_BATCH_ID } from '../data/priceCatalogBatch1';
import type { Store } from '../store/useStore';
import type { PriceType } from '../types/product';
import type { AdminApprovalReason } from '../types/security';
import { AdminApprovalModal } from './AdminApprovalModal';
import { PosNotesSettings } from './PosNotesSettings';
import { SecuritySettings } from './SecuritySettings';
import { UsersManagement } from './UsersManagement';
import { CurrencyRatesSettings } from './CurrencyRatesSettings';
import { CrmSettingsPanel } from './crm/CrmSettingsPanel';
import { PosCheckoutSettingsPanel } from './pos/PosCheckoutSettingsPanel';
import { PosReceiptPrinterSettingsPanel } from './pos/PosReceiptPrinterSettingsPanel';
import { isPosLiteProfile } from '../utils/tenantProductProfile';
import { EmailOutboxSettingsPanel } from './settings/EmailOutboxSettingsPanel';

interface SettingsScreenProps {
  store: Store;
}

type PendingApproval = {
  reason: AdminApprovalReason;
  action: () => void;
};

type SettingsTab = 'general' | 'currency' | 'crm' | 'notes' | 'users' | 'security' | 'email' | 'system';

const TABS: Array<{ id: SettingsTab; label: string; adminOnly?: boolean }> = [
  { id: 'general', label: 'İşletme' },
  { id: 'currency', label: 'Döviz Kurları', adminOnly: true },
  { id: 'crm', label: 'CRM', adminOnly: true },
  { id: 'notes', label: 'Notlar' },
  { id: 'users', label: 'Kullanıcılar', adminOnly: true },
  { id: 'security', label: 'Güvenlik', adminOnly: true },
  { id: 'email', label: 'E-posta', adminOnly: true },
  { id: 'system', label: 'Sistem', adminOnly: true },
];

export function SettingsScreen({ store }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [businessName, setBusinessName] = useState(store.settings.businessName);
  const [lowStockThreshold, setLowStockThreshold] = useState(String(store.settings.lowStockThreshold));

  useEffect(() => {
    setBusinessName(store.settings.businessName);
  }, [store.settings.businessName]);
  const [defaultPriceType, setDefaultPriceType] = useState<PriceType>(store.settings.defaultPriceType);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = store.authSession?.role === 'admin';

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  const saveBusinessSettings = () => {
    const threshold = parseInt(lowStockThreshold, 10);
    const nextSettings = {
      businessName: businessName.trim() || 'Greenleaf Market',
      lowStockThreshold: Number.isNaN(threshold) ? 10 : Math.max(1, threshold),
      defaultPriceType,
    };

    const priceChanged = defaultPriceType !== store.settings.defaultPriceType;
    const applySave = () => {
      store.updateSettings(nextSettings);
      store.setPriceType(defaultPriceType);
    };

    if (priceChanged && isAdmin) {
      setPendingApproval({ reason: 'price_change', action: applySave });
      return;
    }

    applySave();
  };

  const syncLabel =
    store.syncStatus === 'loading'
      ? 'Senkron yükleniyor'
      : store.syncStatus === 'synced'
        ? 'Sunucu ile senkron'
        : 'Yalnızca bu cihaz';

  const syncHealthy = store.syncStatus === 'synced';

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setPendingImportFile(file);
    setPendingApproval({
      reason: 'backup_import',
      action: async () => {
        try {
          const saved = await store.importBackup(file);
          setBackupMessage(saved ? 'Yedek içe aktarıldı ve sunucuya yazıldı.' : 'Yedek içe aktarıldı (sunucu yazılamadı).');
        } catch (error) {
          setBackupMessage(error instanceof Error ? error.message : 'Yedek içe aktarılamadı');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPendingImportFile(null);
      },
    });
  };

  const handlePush = () => {
    setPendingApproval({
      reason: 'backup_push',
      action: async () => {
        const saved = await store.pushStoreToServer();
        setBackupMessage(saved ? 'Veriler sunucuya yüklendi.' : 'Sunucuya yazılamadı.');
      },
    });
  };

  const handleWarehouseReset = () => {
    setPendingApproval({
      reason: 'warehouse_reset',
      action: async () => {
        try {
          const result = await store.resetSalesAndIrsaliyeWarehouse();
          setBackupMessage(
            result.ok
              ? `Tamam: tüm satışlar silindi. Depo irsaliye ile birebir (${result.totalStock.toLocaleString('tr-TR')} adet).`
              : `Yerelde uygulandı (${result.totalStock.toLocaleString('tr-TR')} adet) — sunucuya yazılamadı; Sunucuya Yükle deneyin.`,
          );
        } catch (error) {
          setBackupMessage(error instanceof Error ? error.message : 'Depo sıfırlama başarısız');
        }
      },
    });
  };

  const approvalTitle =
    pendingApproval?.reason === 'price_change'
      ? 'Fiyat Ayarı Onayı'
      : pendingApproval?.reason === 'backup_import'
        ? 'Yedek İçe Aktarma Onayı'
        : pendingApproval?.reason === 'backup_push'
          ? 'Sunucuya Yükleme Onayı'
          : pendingApproval?.reason === 'warehouse_reset'
            ? 'Depo + Satış Sıfırlama'
            : 'Yönetici Onayı';

  const approvalDescription =
    pendingApproval?.reason === 'price_change'
      ? 'Varsayılan fiyat tipi değişikliği için yönetici onayı gerekir.'
      : pendingApproval?.reason === 'backup_import'
        ? 'Yedek dosyası sisteme yüklenecek. Bu işlem mevcut verileri değiştirebilir.'
        : pendingApproval?.reason === 'backup_push'
          ? 'Tüm veriler sunucuya yazılacak. Bu işlem için yönetici onayı gerekir.'
          : pendingApproval?.reason === 'warehouse_reset'
            ? 'Tüm satışlar, iadeler, stok hareketleri ve kasa günleri silinir. Stoklar LUY2026000000002 irsaliyesindeki adetlere yazılır (katalogdaki diğer ürünler 0).'
            : 'Bu işlem için yönetici onayı gerekir.';

  return (
    <div className="module-screen settings-screen--premium">
      <AdminApprovalModal
        open={Boolean(pendingApproval)}
        title={approvalTitle}
        description={approvalDescription}
        reason={pendingApproval?.reason ?? 'price_change'}
        store={store}
        onApproved={() => {
          const action = pendingApproval?.action;
          setPendingApproval(null);
          action?.();
        }}
        onCancel={() => {
          setPendingApproval(null);
          setPendingImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      <header className="settings-hero">
        <div className="settings-hero-top">
          <div className="settings-hero-intro">
            <span className="settings-hero-badge" aria-hidden>AY</span>
            <div>
              <h1>Ayarlar</h1>
              <p>İşletme, güvenlik ve veri yönetimi merkezi</p>
            </div>
          </div>

          {isAdmin && (
            <div className="settings-kpi-strip">
              <div className="settings-kpi">
                <span className="settings-kpi-label">Kullanıcı</span>
                <strong>{store.users.length}</strong>
              </div>
              <div className="settings-kpi">
                <span className="settings-kpi-label">Ürün</span>
                <strong>{store.products.length}</strong>
              </div>
              <div className="settings-kpi">
                <span className="settings-kpi-label">Satış</span>
                <strong>{store.sales.length}</strong>
              </div>
              <div className={`settings-kpi settings-kpi--sync ${syncHealthy ? 'is-healthy' : ''}`}>
                <span className="settings-kpi-label">Senkron</span>
                <strong>{syncHealthy ? 'Aktif' : 'Yerel'}</strong>
              </div>
            </div>
          )}
        </div>

        <nav className="settings-tabs" aria-label="Ayarlar sekmeleri">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="settings-content">
        {activeTab === 'general' && (
          <section className="settings-panel settings-panel--general">
            <div className="settings-panel-head">
              <div>
                <h2>İşletme Profili</h2>
                <p>Mağaza adı, stok eşiği ve varsayılan fiyat tipi</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <label className="settings-field">
                <span>İşletme Adı</span>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </label>

              <label className="settings-field">
                <span>Az Stok Eşiği</span>
                <input type="number" min="1" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
              </label>

              <div className="settings-field settings-field--full">
                <span>Varsayılan Fiyat Tipi</span>
                <div className="settings-segmented">
                  <button
                    type="button"
                    className={defaultPriceType === 'our' ? 'active' : ''}
                    onClick={() => setDefaultPriceType('our')}
                  >
                    Bizim %20 KDV
                  </button>
                  <button
                    type="button"
                    className={defaultPriceType === 'partner' ? 'active' : ''}
                    onClick={() => setDefaultPriceType('partner')}
                  >
                    Partner %20 KDV
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-panel-actions">
              <button type="button" className="btn btn-primary" onClick={saveBusinessSettings}>
                Değişiklikleri Kaydet
              </button>
            </div>

            {isAdmin && (
              <PosReceiptPrinterSettingsPanel store={store} />
            )}
          </section>
        )}

        {activeTab === 'currency' && isAdmin && (
          <CurrencyRatesSettings store={store} />
        )}

        {activeTab === 'crm' && isAdmin && !isPosLiteProfile(store.settings) && (
          <>
            <CrmSettingsPanel store={store} />
            <PosCheckoutSettingsPanel store={store} />
          </>
        )}

        {activeTab === 'crm' && isAdmin && isPosLiteProfile(store.settings) && (
          <PosCheckoutSettingsPanel store={store} />
        )}

        {activeTab === 'notes' && (
          <PosNotesSettings store={store} />
        )}

        {activeTab === 'users' && isAdmin && (
          <UsersManagement store={store} />
        )}

        {activeTab === 'security' && isAdmin && (
          <SecuritySettings store={store} />
        )}

        {activeTab === 'email' && isAdmin && (
          <EmailOutboxSettingsPanel />
        )}

        {activeTab === 'system' && isAdmin && (
          <div className="settings-system-grid">
            <section className="settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h2>Sistem Bilgisi</h2>
                  <p>Katalog, veri durumu ve senkron özeti</p>
                </div>
              </div>

              <div className="settings-stat-grid">
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Katalog</span>
                  <strong>{APP_CATALOG_VERSION}</strong>
                </article>
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Fiyat Listesi</span>
                  <strong>{PRICE_CATALOG_BATCH_ID}</strong>
                </article>
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Ürün</span>
                  <strong>{store.products.length} / {EXPECTED_PRODUCT_COUNT}</strong>
                </article>
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Müşteri</span>
                  <strong>{store.customers.length}</strong>
                </article>
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Stok Hareketi</span>
                  <strong>{store.stockMovements.length}</strong>
                </article>
                <article className="settings-stat-card">
                  <span className="settings-stat-label">Veri Senkronu</span>
                  <strong className={syncHealthy ? 'is-ok' : ''}>{syncLabel}</strong>
                </article>
              </div>
            </section>

            <section className="settings-panel settings-panel--backup">
              <div className="settings-panel-head">
                <div>
                  <h2>Veri Yedekleme</h2>
                  <p>Stok ve satışlar sunucuda paylaşılır; tüm cihazlar aynı veriyi görür</p>
                </div>
              </div>

              {backupMessage && <p className="settings-flash">{backupMessage}</p>}
              {pendingImportFile && pendingApproval?.reason === 'backup_import' && (
                <p className="settings-flash settings-flash--pending">Onay bekleniyor: {pendingImportFile.name}</p>
              )}

              <div className="settings-backup-grid">
                <button type="button" className="settings-backup-card" onClick={() => store.exportBackup()}>
                  <span className="settings-backup-card-tag">İndir</span>
                  <strong>Tam Yedek</strong>
                  <small>Tüm verileri JSON olarak indir</small>
                </button>
                <button type="button" className="settings-backup-card" onClick={() => fileInputRef.current?.click()}>
                  <span className="settings-backup-card-tag">Yükle</span>
                  <strong>Yedek Geri Yükle</strong>
                  <small>Dosyadan içe aktar</small>
                </button>
                <button type="button" className="settings-backup-card settings-backup-card--primary" onClick={handlePush}>
                  <span className="settings-backup-card-tag">Bulut</span>
                  <strong>Sunucuya Yükle</strong>
                  <small>Paylaşımlı veriyi güncelle</small>
                </button>
                <button
                  type="button"
                  className="settings-backup-card settings-backup-card--danger"
                  onClick={handleWarehouseReset}
                >
                  <span className="settings-backup-card-tag">Depo</span>
                  <strong>Satışları Sil + İrsaliye Stok</strong>
                  <small>LUY irsaliye adetleri birebir; satış geçmişi sıfır</small>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => handleImport(e.target.files?.[0])}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
