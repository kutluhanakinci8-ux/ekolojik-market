import { useState } from 'react';
import type { Store } from '../store/useStore';

interface RecoveryEmailModalProps {
  store: Store;
}

export function RecoveryEmailModal({ store }: RecoveryEmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await store.saveRecoveryEmail(email);
      if (result) setError(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recovery-email-title">
      <div className="security-modal-card">
        <h2 id="recovery-email-title">Şifre sıfırlama e-postası gerekli</h2>
        <p className="security-modal-hint">
          POS hesabınızda şifre sıfırlama ve güvenlik bildirimleri için kayıtlı bir e-posta adresi zorunludur.
          Bağlantılar <strong>bildirim@ekolojikmarket.com.tr</strong> adresinden gönderilir.
        </p>

        <form className="security-modal-form" onSubmit={handleSubmit}>
          <label>
            E-posta adresiniz
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="ornek@firma.com"
              required
            />
          </label>

          {error && <p className="landing-flash landing-flash--error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Kaydet ve devam et'}
          </button>
          <button type="button" className="btn btn-text" onClick={() => store.logout()}>
            Çıkış yap
          </button>
        </form>
      </div>
    </div>
  );
}
