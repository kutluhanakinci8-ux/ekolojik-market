import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreProvider';
import { loadLastQuickUser } from '../storage/quickLogin';
import { PinLoginPad } from '../components/PinLoginPad';
import { PasswordField } from '../components/PasswordField';
import {
  clearPosApiToken,
  decodePosApiTokenClaims,
  loadPosApiToken,
} from '../services/posApiAuth';
import { validateStoreCodeForLogin } from '../config/knownTenants';
import { LoginTenantStoreSection } from '../components/LoginTenantStoreSection';
import { resolveLoginTenantId } from '../config/loginTenant';
import { isOwnerAdminUsername } from '../config/ownerAdminUsers';
import {
  DEFAULT_TENANT_ID,
  normalizeStoreCodeInput,
  resolveTenantIdForLoginPage,
  saveTenantId,
} from '../storage/tenantSession';
import { purgeLegacyLoginLockouts } from '../utils/loginLockout';

type LoginMode = 'password' | 'pin';

export function LandingLogin() {
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const registerState = location.state as { registered?: boolean; message?: string } | null;
  const lastQuickUser = loadLastQuickUser();
  const [mode, setMode] = useState<LoginMode>(lastQuickUser ? 'pin' : 'password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pendingTotpUserId, setPendingTotpUserId] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  const [tenantId, setTenantId] = useState(() => resolveTenantIdForLoginPage());
  const loginPageTenantFromUrl = Boolean(
    new URLSearchParams(window.location.search).get('tenant')?.trim(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(registerState?.message ?? null);
  const [busy, setBusy] = useState(false);
  const ownerLogin = isOwnerAdminUsername(username);

  useEffect(() => {
    if (!isOwnerAdminUsername(username)) return;
    saveTenantId(DEFAULT_TENANT_ID);
    setTenantId(DEFAULT_TENANT_ID);
  }, [username]);

  useEffect(() => {
    if (registerState?.message) {
      setSuccess(registerState.message);
      navigate('/giris', { replace: true, state: {} });
    }
  }, [registerState?.message, navigate]);

  useEffect(() => {
    purgeLegacyLoginLockouts();
    const fromUrl = new URLSearchParams(window.location.search).get('tenant')?.trim();
    const resolved = resolveTenantIdForLoginPage();
    if (fromUrl) {
      const claims = decodePosApiTokenClaims(loadPosApiToken());
      const tokenTenant = claims?.tenantId ?? DEFAULT_TENANT_ID;
      if (loadPosApiToken() && tokenTenant !== fromUrl) {
        clearPosApiToken();
      }
    }
    saveTenantId(resolved);
    setTenantId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- giriş sayfası ilk yükleme
  }, []);

  const goToApp = () => {
    navigate('/app', { replace: true });
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const loginUser = (pendingTotpUserId ? pendingUsername : username).trim();
    const resolvedTenant = resolveLoginTenantId(
      loginUser,
      ownerLogin ? DEFAULT_TENANT_ID : normalizeStoreCodeInput(tenantId),
    );
    const tenantError = validateStoreCodeForLogin(resolvedTenant);
    if (tenantError) {
      setError(tenantError);
      setBusy(false);
      return;
    }
    saveTenantId(resolvedTenant);
    setTenantId(resolvedTenant);

    try {
      const result = await store.login(
        pendingTotpUserId ? pendingUsername : username,
        password.trim(),
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
        return;
      }

      goToApp();
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
    <div className="landing-auth-page">
      <div className="landing-auth-card">
        <div className="landing-auth-head">
          <h1>Giriş Yap</h1>
          <p>Mevcut hesabınızla POS paneline erişin</p>
        </div>

        {mode === 'pin' && !pendingTotpUserId ? (
          <PinLoginPad
            store={store}
            tenantId={tenantId}
            onTenantIdChange={setTenantId}
            initialExpandedTenant={loginPageTenantFromUrl}
            defaultUsername={lastQuickUser ?? undefined}
            onSwitchToPassword={() => setMode('password')}
            onSuccess={goToApp}
          />
        ) : (
          <form className="landing-form-grid" onSubmit={handlePasswordSubmit}>
            {!pendingTotpUserId && (
              <>
                <LoginTenantStoreSection
                  tenantId={tenantId}
                  onTenantIdChange={setTenantId}
                  initialExpanded={loginPageTenantFromUrl && !ownerLogin}
                  hideForOwnerAccount={ownerLogin}
                />
                <label>
                  Kullanıcı Adı
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullaniciadi"
                    required
                  />
                </label>
              </>
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
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 haneli kod"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
              </>
            ) : (
              <PasswordField
                label="Şifre"
                autoComplete="off"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
              />
            )}

            {store.syncStatus === 'loading' && (
              <p className="login-sync-hint">Veriler sunucudan yükleniyor...</p>
            )}

            {success && <p className="landing-flash landing-flash--success" role="status">{success}</p>}
            {error && <p className="landing-flash landing-flash--error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Giriş yapılıyor...' : pendingTotpUserId ? 'Doğrula ve Giriş Yap' : 'Giriş Yap'}
            </button>

            {pendingTotpUserId ? (
              <button type="button" className="btn btn-text" onClick={resetTotpStep}>
                Geri dön
              </button>
            ) : (
              <button type="button" className="btn btn-text" onClick={() => setMode('pin')}>
                PIN ile giriş (kasiyer)
              </button>
            )}
          </form>
        )}

        <p className="landing-auth-switch">
          Hesabınız yok mu? <Link to="/kayit">Ücretsiz kayıt olun</Link>
        </p>
      </div>
    </div>
  );
}
