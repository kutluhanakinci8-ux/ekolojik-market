import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store/StoreProvider';
import { decodePosApiTokenClaims, loadPosApiToken } from '../services/posApiAuth';
import { isPlatformApiRole } from '../config/platformOperators';
import { PlatformAuditTab } from './PlatformAuditTab';
import { PlatformBillingTab } from './PlatformBillingTab';
import { PlatformSupportTab } from './PlatformSupportTab';
import { PlatformCommsTab } from './PlatformCommsTab';
import { PlatformOverviewTab } from './PlatformOverviewTab';
import { PlatformSecurityTab } from './PlatformSecurityTab';
import { PlatformInfrastructureTab } from './PlatformInfrastructureTab';
import { PlatformTenantsTab } from './PlatformTenantsTab';
import { PlatformUsersTab, type PlatformUsersTabFocus } from './PlatformUsersTab';
import './platform.css';

type PlatformTab =
  | 'overview'
  | 'billing'
  | 'support'
  | 'tenants'
  | 'users'
  | 'security'
  | 'audit'
  | 'comms'
  | 'infrastructure';

export function PlatformApp() {
  const store = useStore();
  const claims = decodePosApiTokenClaims(loadPosApiToken());
  const [activeTab, setActiveTab] = useState<PlatformTab>('overview');
  const [usersTabFocus, setUsersTabFocus] = useState<PlatformUsersTabFocus | null>(null);
  const [overviewRefreshTick, setOverviewRefreshTick] = useState(0);

  if (!store.authSession || !isPlatformApiRole(claims?.role)) {
    return <Navigate to="/giris" replace />;
  }

  const handleHeaderRefresh = () => {
    if (activeTab === 'overview') {
      setOverviewRefreshTick((t) => t + 1);
    }
  };

  return (
    <div className="platform-shell platform-shell--premium">
      <header className="platform-header platform-header--premium">
        <div>
          <h1>Ekolojik Platform</h1>
          <p className="platform-subtitle">
            Operasyon merkezi — cari, güvenlik, iletişim ve kiracı portföyü
          </p>
        </div>
        <div className="platform-header-actions">
          <span className="platform-user">{store.authSession.displayName}</span>
          <button
            type="button"
            className="btn btn-text platform-header-refresh"
            onClick={handleHeaderRefresh}
            disabled={activeTab !== 'overview'}
            title={activeTab === 'overview' ? 'Genel bakışı yenile' : 'Yalnızca Genel bakış sekmesinde kullanılır'}
          >
            Yenile
          </button>
          <button type="button" className="btn btn-text" onClick={() => store.logout()}>
            Çıkış
          </button>
        </div>
      </header>

      <nav className="platform-tabs platform-tabs--premium" aria-label="Platform bölümleri">
        <button
          type="button"
          className={`platform-tab ${activeTab === 'overview' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Genel bakış
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'billing' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Gelir
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'support' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          Destek
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'tenants' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('tenants')}
        >
          Kiracılar
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'users' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Kullanıcı işlemleri
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'security' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Güvenlik
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'audit' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Denetim
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'comms' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('comms')}
        >
          Posta & mesaj
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'infrastructure' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('infrastructure')}
        >
          Altyapı
        </button>
      </nav>

      {activeTab === 'infrastructure' ? (
        <PlatformInfrastructureTab />
      ) : activeTab === 'billing' ? (
        <PlatformBillingTab />
      ) : activeTab === 'support' ? (
        <PlatformSupportTab />
      ) : activeTab === 'comms' ? (
        <PlatformCommsTab />
      ) : activeTab === 'tenants' ? (
        <PlatformTenantsTab />
      ) : activeTab === 'audit' ? (
        <PlatformAuditTab />
      ) : activeTab === 'security' ? (
        <PlatformSecurityTab
          onNavigateUsers={(focus) => {
            setUsersTabFocus(focus);
            setActiveTab('users');
          }}
        />
      ) : activeTab === 'users' ? (
        <PlatformUsersTab
          focus={usersTabFocus}
          onFocusApplied={() => setUsersTabFocus(null)}
        />
      ) : (
        <PlatformOverviewTab refreshTick={overviewRefreshTick} />
      )}
    </div>
  );
}
