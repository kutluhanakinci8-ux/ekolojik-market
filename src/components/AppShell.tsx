import { buildVisibleNavItems } from '../data/navigation';
import type { Store } from '../store/useStore';
import { formatBusinessBrand, formatCurrency } from '../utils/format';

export type AppPage =
  | 'dashboard'
  | 'sales'
  | 'stock'
  | 'reports'
  | 'accounting'
  | 'transactions'
  | 'customers'
  | 'cashier'
  | 'posta'
  | 'settings';

interface AppShellProps {
  store: Store;
  onForceServerSync?: () => void;
  page: AppPage;
  allowedTabs: AppPage[];
  onPageChange: (page: AppPage) => void;
  onLogout: () => void;
  onBrandSecretClick?: () => void;
  navBadgeOverrides?: Partial<Record<AppPage, number>>;
  children: React.ReactNode;
}

export function AppShell({
  store,
  onForceServerSync,
  page,
  allowedTabs,
  onPageChange,
  onLogout,
  onBrandSecretClick,
  navBadgeOverrides,
  children,
}: AppShellProps) {
  const visibleNavItems = buildVisibleNavItems(allowedTabs);

  const showSalesSyncAlert =
    store.hasStaleLocalSalesData || store.syncStatus === 'local-only';

  return (
    <div className="app-shell">
      {showSalesSyncAlert ? (
        <div
          className="app-sync-alert"
          role="status"
          style={{
            background: '#7f1d1d',
            color: '#fff',
            padding: '10px 16px',
            fontSize: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Bu ekranda <strong>eski satış verisi</strong> var — Günlük Kasa ({formatCurrency(store.todayTotal)})
            ve raporlar yanlış görünebilir. Sunucudaki sıfır kayıtla eşitleyin.
          </span>
          {onForceServerSync ? (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: '#fff', borderColor: '#fff' }}
              onClick={() => onForceServerSync()}
            >
              Sunucudan temizle
            </button>
          ) : null}
        </div>
      ) : null}
      <header className="app-topbar app-topbar--premium">
        <div className="app-topbar-left">
          <div
            className={`app-topbar-brand ${onBrandSecretClick ? 'app-topbar-brand-secret' : ''}`}
            onClick={onBrandSecretClick}
          >
            <span className="app-topbar-logo" aria-hidden>🌿</span>
            <strong className="app-topbar-brand-name" title={formatBusinessBrand(store.settings.businessName)}>
              {formatBusinessBrand(store.settings.businessName)}
            </strong>
          </div>

          <div className="app-topbar-cash">
            <span>Günlük Kasa</span>
            <strong>{formatCurrency(store.todayTotal)}</strong>
          </div>
        </div>

        <nav className="app-topbar-tabs" aria-label="Ana menü">
          {visibleNavItems.map((item) => {
            const override = navBadgeOverrides?.[item.id];
            const badge = override != null && override > 0 ? override : item.badge?.(store);
            return (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? 'active' : ''}
                onClick={() => onPageChange(item.id)}
                title={item.label}
              >
                <span className="nav-label">{item.label}</span>
                {badge != null && badge > 0 && (
                  <span className="nav-badge warn">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="app-topbar-right">
          <div className="app-topbar-user" title={store.authSession?.username}>
            <span className="app-topbar-user-name">{store.authSession?.displayName}</span>
            <button type="button" className="btn btn-sm btn-outline app-topbar-logout" onClick={onLogout}>
              Çıkış
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
