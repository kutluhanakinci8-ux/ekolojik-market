import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { LoginAuditEntry } from '../types/security';
import { USER_ROLE_LABELS } from '../types/user';
import { formatClientIp } from '../utils/clientIp';
import { LoginActivityDetailModal } from './LoginActivityDetailModal';

interface SecuritySettingsProps {
  store: Store;
}

function formatDeviceShort(deviceInfo: string): string {
  const parts = deviceInfo.split(' · ');
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`;
  return deviceInfo.slice(0, 36);
}

export function SecuritySettings({ store }: SecuritySettingsProps) {
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockouts, setLockouts] = useState(() => store.getLoginLockouts());
  const [selectedLogin, setSelectedLogin] = useState<LoginAuditEntry | null>(null);

  const currentUser = store.users.find((user) => user.id === store.authSession?.userId);
  const totpEnabled = Boolean(currentUser?.totpEnabled);
  const isPrimaryAdmin = Boolean(currentUser?.isPrimaryAdmin);
  const lockableUsers = useMemo(
    () => store.users.filter((user) => !user.isPrimaryAdmin),
    [store.users],
  );
  const lockedUserCount = lockableUsers.filter((user) => !user.isActive).length;

  const selectedActivities = useMemo(
    () => (selectedLogin ? store.getActivitiesForLogin(selectedLogin) : []),
    [selectedLogin, store, store.activityAuditLog],
  );

  const startTotpSetup = () => {
    setMessage(null);
    setError(null);
    const setup = store.beginTotpSetup();
    if (!setup) {
      setError('2FA kurulumu başlatılamadı.');
      return;
    }
    setSetupSecret(setup.secret);
    setSetupUri(setup.uri);
  };

  const confirmTotp = async () => {
    if (!setupSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await store.enableTotp(setupSecret, totpCode);
      if (result) {
        setError(result);
        return;
      }
      setSetupSecret(null);
      setSetupUri(null);
      setTotpCode('');
      setMessage('İki faktörlü doğrulama (2FA) etkinleştirildi.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableTotp = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await store.disableTotp(disableCode);
      if (result) {
        setError(result);
        return;
      }
      setDisableCode('');
      setMessage('2FA devre dışı bırakıldı.');
    } finally {
      setBusy(false);
    }
  };

  const unlockAccount = (username: string) => {
    store.unlockUserLogin(username);
    setLockouts(store.getLoginLockouts());
    setMessage(`${username} hesabının giriş kilidi kaldırıldı.`);
  };

  const handleLockUser = (userId: string, displayName: string) => {
    setMessage(null);
    setError(null);
    const result = store.lockUserAccess(userId);
    if (result) {
      setError(result);
      return;
    }
    setMessage(`${displayName} kullanıcısının giriş izni kilitlendi.`);
  };

  const handleUnlockUser = (userId: string, displayName: string) => {
    setMessage(null);
    setError(null);
    const result = store.unlockUserAccess(userId);
    if (result) {
      setError(result);
      return;
    }
    setMessage(`${displayName} kullanıcısının giriş izni yeniden açıldı.`);
  };

  return (
    <section className="settings-panel settings-panel--security">
      <LoginActivityDetailModal
        entry={selectedLogin}
        activities={selectedActivities}
        onClose={() => setSelectedLogin(null)}
      />

      <div className="settings-panel-head">
        <div>
          <h2>Güvenlik Merkezi</h2>
          <p>2FA, giriş kilidi ve oturum kayıtları · Otomatik çıkış: 5 dk</p>
        </div>
      </div>

      {message && <p className="settings-flash">{message}</p>}
      {error && <p className="settings-flash settings-flash--error" role="alert">{error}</p>}

      <div className="security-settings-grid security-settings-grid--premium">
        <article className="security-feature-card">
          <div className="security-feature-head">
            <div>
              <h3>İki Faktörlü Doğrulama</h3>
              <p>Google Authenticator ile yönetici girişi</p>
            </div>
            <span className={`security-status-pill ${totpEnabled ? 'is-on' : ''}`}>
              {totpEnabled ? 'Aktif' : 'Kapalı'}
            </span>
          </div>

          {totpEnabled ? (
            <div className="security-feature-body">
              <label className="settings-field">
                <span>Kapatmak için mevcut kod</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <button type="button" className="btn btn-outline" onClick={handleDisableTotp} disabled={busy}>
                2FA Kapat
              </button>
            </div>
          ) : setupSecret ? (
            <div className="security-feature-body">
              <p className="security-feature-hint">Google Authenticator&apos;a ekleyin:</p>
              <code className="security-secret">{setupSecret}</code>
              {setupUri && (
                <a className="security-totp-link" href={setupUri}>
                  Authenticator ile aç
                </a>
              )}
              <label className="settings-field">
                <span>Doğrulama kodu</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <div className="security-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setSetupSecret(null); setSetupUri(null); }}>
                  İptal
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmTotp} disabled={busy}>
                  Etkinleştir
                </button>
              </div>
            </div>
          ) : (
            <div className="security-feature-body">
              <p className="security-feature-hint">Hassas işlemler ve yönetici girişi için 6 haneli TOTP kodu kullanın.</p>
              <button type="button" className="btn btn-primary" onClick={startTotpSetup}>
                2FA Kurulumunu Başlat
              </button>
            </div>
          )}
        </article>

        <article className="security-feature-card">
          <div className="security-feature-head">
            <div>
              <h3>Kilitli Hesaplar</h3>
              <p>5 hatalı giriş sonrası yönetici onayı</p>
            </div>
            <span className={`security-status-pill ${lockouts.length > 0 ? 'is-warn' : 'is-on'}`}>
              {lockouts.length > 0 ? `${lockouts.length} kilitli` : 'Temiz'}
            </span>
          </div>

          <div className="security-feature-body">
            {lockouts.length === 0 ? (
              <p className="security-feature-hint">Şu anda kilitli hesap bulunmuyor.</p>
            ) : (
              <ul className="security-lockout-list security-lockout-list--premium">
                {lockouts.map((item) => (
                  <li key={item.username} className="security-lockout-item security-lockout-item--premium">
                    <div>
                      <strong>@{item.username}</strong>
                      <span>{item.failedAttempts} hatalı deneme</span>
                      {item.requiresAdminUnlock && <span className="security-lockout-badge">Onay gerekli</span>}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => unlockAccount(item.username)}>
                      Kilidi Aç
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      {isPrimaryAdmin && (
        <article className="security-feature-card security-feature-card--wide">
          <div className="security-feature-head">
            <div>
              <h3>Anında Giriş Kilidi</h3>
              <p>Ana yönetici olarak kullanıcı giriş iznini hemen iptal edin veya geri açın</p>
            </div>
            <span className={`security-status-pill ${lockedUserCount > 0 ? 'is-warn' : 'is-on'}`}>
              {lockedUserCount > 0 ? `${lockedUserCount} kilitli kullanıcı` : 'Tümü açık'}
            </span>
          </div>

          <div className="security-feature-body">
            <ul className="security-user-lock-list">
              {lockableUsers.map((user) => (
                <li key={user.id} className={`security-user-lock-item ${!user.isActive ? 'is-locked' : ''}`}>
                  <div className="security-user-lock-info">
                    <strong>{user.displayName}</strong>
                    <span>@{user.username}</span>
                    <span className="security-user-lock-role">{USER_ROLE_LABELS[user.role]}</span>
                    {!user.isActive && <span className="security-lockout-badge">Giriş kapalı</span>}
                  </div>
                  {user.isActive ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-soft"
                      onClick={() => handleLockUser(user.id, user.displayName)}
                    >
                      Girişi Kilitle
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleUnlockUser(user.id, user.displayName)}
                    >
                      Kilidi Aç
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </article>
      )}

      <div className="security-audit security-audit--premium">
        <div className="settings-panel-head settings-panel-head--compact">
          <div>
            <h3>Giriş Kaydı</h3>
            <p>Son {store.loginAuditLog.length} giriş denemesi · Başarılı satıra tıklayın, o oturumdaki tüm hareketleri görün</p>
          </div>
        </div>

        <div className="security-audit-table-wrap security-audit-table-wrap--premium">
          <table className="security-audit-table security-audit-table--premium">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Yöntem</th>
                <th>Durum</th>
                <th>IP</th>
                <th>Cihaz</th>
              </tr>
            </thead>
            <tbody>
              {store.loginAuditLog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="security-audit-empty">Henüz giriş kaydı yok.</td>
                </tr>
              ) : (
                store.loginAuditLog.map((entry) => {
                  const activityCount = entry.success ? store.getActivitiesForLogin(entry).length : 0;
                  return (
                    <tr
                      key={entry.id}
                      className={`security-audit-row ${entry.success ? 'is-clickable' : ''} ${entry.success ? '' : 'is-failed'}`}
                      onClick={() => entry.success && setSelectedLogin(entry)}
                      tabIndex={entry.success ? 0 : -1}
                      onKeyDown={(event) => {
                        if (entry.success && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          setSelectedLogin(entry);
                        }
                      }}
                    >
                      <td>{new Date(entry.createdAt).toLocaleString('tr-TR')}</td>
                      <td>
                        {entry.displayName ?? entry.username}
                        {entry.success && activityCount > 0 && (
                          <span className="security-audit-count">{activityCount} hareket</span>
                        )}
                      </td>
                      <td>
                        <span className="security-method-pill">{entry.method === 'pin' ? 'PIN' : 'Şifre'}</span>
                      </td>
                      <td>
                        <span className={`security-result-pill ${entry.success ? 'is-success' : 'is-fail'}`}>
                          {entry.success ? 'Başarılı' : (entry.failureReason ?? 'Başarısız')}
                        </span>
                      </td>
                      <td className="security-audit-ip" title={entry.clientIp ?? 'IP kaydı yok'}>
                        {formatClientIp(entry.clientIp)}
                      </td>
                      <td className="security-audit-device" title={entry.deviceInfo}>
                        {formatDeviceShort(entry.deviceInfo)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
