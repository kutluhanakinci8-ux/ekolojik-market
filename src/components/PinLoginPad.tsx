import { useState } from 'react';
import type { Store } from '../store/useStore';
import { loadLastQuickUser } from '../storage/quickLogin';

interface PinLoginPadProps {
  store: Store;
  defaultUsername?: string;
  onSwitchToPassword: () => void;
  onSuccess?: () => void;
}

export function PinLoginPad({ store, defaultUsername, onSwitchToPassword, onSuccess }: PinLoginPadProps) {
  const [username, setUsername] = useState(defaultUsername ?? loadLastQuickUser() ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appendDigit = (digit: string) => {
    if (pin.length >= 6) return;
    setPin((prev) => prev + digit);
  };

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setError('PIN 6 haneli olmalıdır.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await store.refreshTenantData();
      const result = await store.loginWithPin(username, pin);
      if (result.status === 'error' || result.status === 'locked') {
        setError(result.message);
        setPin('');
      } else if (result.status === 'success') {
        onSuccess?.();
      }
    } catch {
      setError('PIN girişi başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pin-login">
      <label className="pin-login-username">
        Kullanıcı Adı
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
        />
      </label>

      <div className="pin-display" aria-label="PIN">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className={`pin-dot ${index < pin.length ? 'is-filled' : ''}`} />
        ))}
      </div>

      <div className="pin-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => (
          <button
            key={key}
            type="button"
            className={`pin-key ${key === 'clear' || key === 'back' ? 'pin-key--action' : ''}`}
            onClick={() => {
              if (key === 'clear') setPin('');
              else if (key === 'back') setPin((prev) => prev.slice(0, -1));
              else appendDigit(key);
            }}
          >
            {key === 'clear' ? 'C' : key === 'back' ? '←' : key}
          </button>
        ))}
      </div>

      {error && <p className="login-error" role="alert">{error}</p>}

      <button
        type="button"
        className="btn btn-primary login-submit"
        onClick={handleSubmit}
        disabled={busy || pin.length !== 6 || !username.trim()}
      >
        {busy ? 'Giriş yapılıyor...' : 'PIN ile Giriş'}
      </button>

      <button type="button" className="btn btn-text login-mode-switch" onClick={onSwitchToPassword}>
        Şifre ile giriş
      </button>
    </div>
  );
}
