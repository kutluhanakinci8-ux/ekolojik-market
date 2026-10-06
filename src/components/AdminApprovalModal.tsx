import { useEffect, useState } from 'react';
import type { Store } from '../store/useStore';
import type { AdminApprovalReason } from '../types/security';

interface AdminApprovalModalProps {
  open: boolean;
  title: string;
  description: string;
  reason: AdminApprovalReason;
  store: Store;
  onApproved: () => void;
  onCancel: () => void;
}

const REASON_LABELS: Record<AdminApprovalReason, string> = {
  user_delete: 'Kullanıcı silme',
  price_change: 'Fiyat ayarı değişikliği',
  refund: 'İade işlemi',
  backup_import: 'Yedek içe aktarma',
  backup_push: 'Sunucuya veri yükleme',
};

export function AdminApprovalModal({
  open,
  title,
  description,
  reason,
  store,
  onApproved,
  onCancel,
}: AdminApprovalModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername('');
    setPassword('');
    setTotpCode('');
    setError(null);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await store.verifyAdminCredentials(username, password, totpCode || undefined);
      if (result) {
        setError(result);
        return;
      }
      onApproved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true">
      <div className="security-modal-card security-modal-card--wide">
        <h2>{title}</h2>
        <p className="security-modal-hint">{description}</p>
        <p className="security-modal-tag">İşlem: {REASON_LABELS[reason]}</p>

        <form className="security-modal-form" onSubmit={handleSubmit}>
          <label>
            Yönetici Kullanıcı Adı
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Yönetici Şifresi
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            2FA Kodu (yönetici için)
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli kod"
              autoComplete="one-time-code"
            />
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <div className="security-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Doğrulanıyor...' : 'Onayla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
