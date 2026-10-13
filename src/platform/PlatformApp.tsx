import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreProvider';
import {
  decodePosApiTokenClaims,
  loadPosApiToken,
  syncPosApiTokenToCurrentTenant,
} from '../services/posApiAuth';
import { isPlatformApiRole } from '../config/platformOperators';
import {
  fetchPlatformTenantDetail,
  fetchPlatformTenants,
  type PlatformTenantSummary,
  type PlatformTenantUserRow,
} from '../services/platformApi';
import { saveTenantId } from '../storage/tenantSession';
import './platform.css';

export function PlatformApp() {
  const store = useStore();
  const navigate = useNavigate();
  const claims = decodePosApiTokenClaims(loadPosApiToken());
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailUsers, setDetailUsers] = useState<PlatformTenantUserRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformTenants();
    if (!result.ok) {
      setError(result.error ?? 'Liste yüklenemedi');
      setTenants([]);
    } else {
      setTenants(result.tenants ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  if (!store.authSession || !isPlatformApiRole(claims?.role)) {
    return <Navigate to="/giris" replace />;
  }

  const openTenantPos = (tenantId: string) => {
    saveTenantId(tenantId);
    syncPosApiTokenToCurrentTenant();
    navigate('/app', { replace: true });
  };

  const showDetail = async (tenantId: string) => {
    setSelectedId(tenantId);
    setDetailLoading(true);
    setDetailUsers([]);
    const result = await fetchPlatformTenantDetail(tenantId);
    if (result.ok && result.tenant?.users) {
      setDetailUsers(result.tenant.users);
    }
    setDetailLoading(false);
  };

  const selected = tenants.find((t) => t.tenantId === selectedId);

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div>
          <h1>Ekolojik Platform</h1>
          <p className="platform-subtitle">
            Tüm kiracılar — stok, satış, kullanıcı güvenliği ve tahsilat takibi
          </p>
        </div>
        <div className="platform-header-actions">
          <span className="platform-user">{store.authSession.displayName}</span>
          <button type="button" className="btn btn-text" onClick={() => store.logout()}>
            Çıkış
          </button>
        </div>
      </header>

      {error && <p className="landing-flash landing-flash--error" role="alert">{error}</p>}

      <div className="platform-layout">
        <section className="platform-tenant-list" aria-label="Kiracı listesi">
          {loading ? (
            <p>Yükleniyor…</p>
          ) : (
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Mağaza</th>
                  <th>Ürün</th>
                  <th>Düşük stok</th>
                  <th>30g satış</th>
                  <th>Kullanıcı</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.tenantId} className={selectedId === t.tenantId ? 'platform-row--active' : ''}>
                    <td>
                      <strong>{t.businessName}</strong>
                      <div className="platform-muted">{t.label}</div>
                    </td>
                    <td>{t.productCount}</td>
                    <td className={t.lowStockCount > 0 ? 'platform-warn' : ''}>{t.lowStockCount}</td>
                    <td>{t.recentSaleCount30d}</td>
                    <td>{t.activeUserCount}</td>
                    <td className="platform-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void showDetail(t.tenantId)}>
                        Detay
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openTenantPos(t.tenantId)}>
                        POS aç
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="platform-detail" aria-label="Kiracı detayı">
          {!selected ? (
            <p className="platform-muted">Detay için bir mağaza seçin.</p>
          ) : (
            <>
              <h2>{selected.businessName}</h2>
              <dl className="platform-stats">
                <div><dt>Mağaza kodu</dt><dd>{selected.tenantId}</dd></div>
                <div><dt>Plan</dt><dd>{selected.plan ?? selected.productProfile}</dd></div>
                <div><dt>30 gün ciro (TRY)</dt><dd>{selected.revenue30dTry.toLocaleString('tr-TR')}</dd></div>
                <div><dt>Toplam satış kaydı</dt><dd>{selected.saleCount}</dd></div>
                <div><dt>Kayıt e-postası</dt><dd>{selected.registrationEmail ?? '—'}</dd></div>
              </dl>
              <h3>Kullanıcılar & güvenlik</h3>
              {detailLoading ? (
                <p>Yükleniyor…</p>
              ) : (
                <ul className="platform-user-list">
                  {detailUsers.map((u) => (
                    <li key={u.id}>
                      <span>{u.displayName} ({u.username})</span>
                      <span className="platform-muted">
                        {u.role}
                        {!u.isActive ? ' · pasif' : ''}
                        {u.totpEnabled ? ' · 2FA' : ''}
                        {u.hasRecoveryEmail ? '' : ' · e-posta eksik'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn-primary platform-open-pos" onClick={() => openTenantPos(selected.tenantId)}>
                Bu mağazada POS’a geç
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
