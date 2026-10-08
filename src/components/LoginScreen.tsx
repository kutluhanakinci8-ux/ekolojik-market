import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Store } from '../store/useStore';
import { formatBusinessBrand } from '../utils/format';
import { loadLastQuickUser } from '../storage/quickLogin';
import { PinLoginPad } from './PinLoginPad';

interface LoginScreenProps {
  store: Store;
}

type LoginMode = 'password' | 'pin';

export function LoginScreen({ store }: LoginScreenProps) {
  const location = useLocation();
  const registerState = location.state as {
    registered?: boolean;
    message?: string;
    username?: string;
    postaSetup?: boolean;
  } | null;
  const lastQuickUser = loadLastQuickUser();
  const [mode, setMode] = useState<LoginMode>(lastQuickUser ? 'pin' : 'password');
  const [username, setUsername] = useState(registerState?.username ?? '');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pendingTotpUserId, setPendingTotpUserId] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await store.login(
        pendingTotpUserId ? pendingUsername : username,
        password,
        totpCode || undefined,
      );

      if (result.status === 'totp_required') {
        setPendingTotpUserId(result.userId);
        setPendingUsername(result.username);
        setTotpCode('');
        return;
      }

      if (result.status === 'locked' || result.status === 'error') {
        setError(result.message);
        if (result.status === 'error' && pendingTotpUserId) {
          setTotpCode('');
        }
      } else {
        setPendingTotpUserId(null);
        setPendingUsername('');
        setTotpCode('');
      }
    } catch {
      setError('Giriş yapılamadı. Sayfayı yenileyip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const resetTotpStep = () => {
    setPendingTotpUserId(null);
    setPendingUsername('');
    setTotpCode('');
    setError(null);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo" aria-hidden>🌿</span>
          <h1>{formatBusinessBrand(store.settings.businessName)}</h1>
          <p>{mode === 'pin' ? 'Kasiyer PIN ile hızlı giriş' : 'Kullanıcı adı ve şifrenizle giriş yapın'}</p>
          {registerState?.registered && registerState.message && (
            <p className="login-register-hint" role="status" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
              {registerState.message}
              {registerState.postaSetup ? ' Posta kurulumu girişten sonra başlar.' : ''}
            </p>
          )}
        </div>

        {mode === 'pin' && !pendingTotpUserId ? (
          <PinLoginPad
            store={store}
            defaultUsername={lastQuickUser ?? undefined}
            onSwitchToPassword={() => setMode('password')}
          />
        ) : (
          <form className="login-form" onSubmit={handlePasswordSubmit}>
            {!pendingTotpUserId && (
              <label>
                Kullanıcı Adı
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınız"
                  required
                />
              </label>
            )}

            {pendingTotpUserId ? (
              <>
                <p className="login-totp-hint">
                  <strong>@{pendingUsername}</strong> için Google Authenticator kodunu girin.
                </p>
                <label>
                  2FA Doğrulama Kodu
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 haneli kod"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <input type="hidden" value={password} readOnly />
              </>
            ) : (
              <label>
                Şifre
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
            )}

            {store.syncStatus === 'loading' && (
              <p className="login-sync-hint">Veriler sunucudan yükleniyor...</p>
            )}

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
              {busy ? 'Giriş yapılıyor...' : pendingTotpUserId ? 'Doğrula ve Giriş Yap' : 'Giriş Yap'}
            </button>

            {pendingTotpUserId ? (
              <button type="button" className="btn btn-text login-mode-switch" onClick={resetTotpStep}>
                Geri dön
              </button>
            ) : (
              <button type="button" className="btn btn-text login-mode-switch" onClick={() => setMode('pin')}>
                PIN ile giriş (kasiyer)
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
