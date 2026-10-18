import type { LoginAuditEntry } from '../types/security';
import type { ActivityAuditEntry } from '../utils/activityAudit';
import { formatActivityMeta, getActivityCategoryLabel, summarizeActivities } from '../utils/activityAudit';
import { formatClientIp } from '../utils/clientIp';

interface LoginActivityDetailModalProps {
  entry: LoginAuditEntry | null;
  activities: ActivityAuditEntry[];
  onClose: () => void;
}

export function LoginActivityDetailModal({ entry, activities, onClose }: LoginActivityDetailModalProps) {
  if (!entry) return null;

  const sorted = [...activities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const summary = summarizeActivities(sorted);

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="security-modal-card security-modal-card--wide login-activity-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="login-activity-modal-head">
          <div>
            <h2>Oturum Aktivite Kaydı</h2>
            <p>
              {entry.displayName ?? entry.username}
              {' · '}
              {new Date(entry.createdAt).toLocaleString('tr-TR')}
            </p>
          </div>
          <button type="button" className="login-activity-close" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="login-activity-meta">
          <span className={`security-result-pill ${entry.success ? 'is-success' : 'is-fail'}`}>
            {entry.success ? 'Başarılı giriş' : (entry.failureReason ?? 'Başarısız')}
          </span>
          <span className="security-method-pill">{entry.method === 'pin' ? 'PIN' : 'Şifre'}</span>
          <span className="login-activity-ip">IP: {formatClientIp(entry.clientIp)}</span>
          <span className="login-activity-device" title={entry.deviceInfo}>{entry.deviceInfo}</span>
        </div>

        {!entry.success ? (
          <p className="login-activity-empty">Başarısız giriş denemelerinde oturum aktivitesi kaydı oluşmaz.</p>
        ) : sorted.length === 0 ? (
          <p className="login-activity-empty">Bu oturum için henüz aktivite kaydı yok.</p>
        ) : (
          <div className="login-activity-timeline-wrap">
            <div className="login-activity-summary">
              <p className="login-activity-count">{sorted.length} hareket</p>
              <div className="login-activity-summary-pills">
                {Object.entries(summary).map(([label, count]) => (
                  <span key={label} className="login-activity-summary-pill">
                    {label}: {count}
                  </span>
                ))}
              </div>
            </div>
            <ol className="login-activity-timeline">
              {sorted.map((activity) => {
                const meta = formatActivityMeta(activity.meta);
                return (
                  <li key={activity.id} className={`login-activity-item login-activity-item--${activity.action}`}>
                    <div className="login-activity-item-time">
                      {new Date(activity.createdAt).toLocaleString('tr-TR')}
                    </div>
                    <div className="login-activity-item-body">
                      <span className="login-activity-item-tag">{getActivityCategoryLabel(activity.action)}</span>
                      <strong>{activity.summary}</strong>
                      {meta && <span className="login-activity-item-meta">{meta}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
