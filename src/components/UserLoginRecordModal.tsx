import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { LoginAuditEntry } from '../types/security';
import { formatClientIp } from '../utils/clientIp';
import { LoginActivityDetailModal } from './LoginActivityDetailModal';

interface UserLoginRecordModalProps {
  store: Store;
  userId: string;
  displayName: string;
  username: string;
  onClose: () => void;
}

function formatDeviceShort(deviceInfo: string): string {
  const parts = deviceInfo.split(' · ');
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`;
  return deviceInfo.slice(0, 36);
}

export function UserLoginRecordModal({
  store,
  userId,
  displayName,
  username,
  onClose,
}: UserLoginRecordModalProps) {
  const [selectedLogin, setSelectedLogin] = useState<LoginAuditEntry | null>(null);

  const entries = useMemo(
    () => store.loginAuditLog.filter(
      (entry) => entry.userId === userId || entry.username === username,
    ),
    [store.loginAuditLog, userId, username],
  );

  const selectedActivities = selectedLogin
    ? store.getActivitiesForLogin(selectedLogin)
    : [];

  return (
    <>
      <LoginActivityDetailModal
        entry={selectedLogin}
        activities={selectedActivities}
        onClose={() => setSelectedLogin(null)}
      />

      <div className="user-activity-edit-backdrop" role="presentation" onClick={onClose}>
        <div
          className="user-login-record-modal"
          role="dialog"
          aria-labelledby="user-login-record-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="user-login-record-head">
            <div>
              <h3 id="user-login-record-title">Giriş Kaydı</h3>
              <p className="module-hint">{displayName} · @{username}</p>
            </div>
            <button type="button" className="login-activity-close" onClick={onClose} aria-label="Kapat">
              ✕
            </button>
          </div>

          <div className="security-audit-table-wrap security-audit-table-wrap--premium">
            <table className="security-audit-table security-audit-table--premium">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Yöntem</th>
                  <th>Durum</th>
                  <th>IP</th>
                  <th>Cihaz</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="security-audit-empty">Bu kullanıcı için giriş kaydı yok.</td>
                  </tr>
                ) : (
                  entries.map((entry) => {
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
                          <span className="security-method-pill">{entry.method === 'pin' ? 'PIN' : 'Şifre'}</span>
                        </td>
                        <td>
                          <span className={`security-result-pill ${entry.success ? 'is-success' : 'is-fail'}`}>
                            {entry.success ? 'Başarılı' : (entry.failureReason ?? 'Başarısız')}
                          </span>
                          {entry.success && activityCount > 0 && (
                            <span className="security-audit-count">{activityCount} hareket</span>
                          )}
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

          <p className="module-hint user-login-record-hint">
            Başarılı giriş satırına tıklayarak o oturumdaki tüm hareketleri görüntüleyebilirsiniz.
          </p>
        </div>
      </div>
    </>
  );
}
