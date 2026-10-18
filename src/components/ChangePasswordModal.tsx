import { useState } from 'react';
import type { Store } from '../store/useStore';

interface ChangePasswordModalProps {
  store: Store;
}

export function ChangePasswordModal({ store }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setBusy(true);
    try {
      const result = await store.changePassword(password);
      if (result) setError(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="security-modal-card">
        <h2 id="change-password-title">Şifrenizi Değiştirin</h2>
        <p className="security-modal-hint">
          İlk girişte varsayılan şifreyi değiştirmeniz gerekir. Devam etmek için güçlü bir şifre belirleyin.
        </p>

        <form className="security-modal-form" onSubmit={handleSubmit}>
          <label>
            Yeni Şifre
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Yeni Şifre (Tekrar)
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Şifreyi Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
