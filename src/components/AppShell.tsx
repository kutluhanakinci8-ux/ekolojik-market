import { NAV_ITEMS } from '../data/navigation';
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
  | 'settings';

interface AppShellProps {
  store: Store;
  page: AppPage;
  allowedTabs: AppPage[];
  onPageChange: (page: AppPage) => void;
  onLogout: () => void;
  onBrandSecretClick?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  store,
  page,
  allowedTabs,
  onPageChange,
  onLogout,
  onBrandSecretClick,
  children,
}: AppShellProps) {
  const visibleNavItems = NAV_ITEMS.filter((item) => allowedTabs.includes(item.id));

  return (
    <div className="app-shell">
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
            const badge = item.badge?.(store);
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
