import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { registerTenant } from '../services/authApi';
import { saveTenantId } from '../storage/tenantSession';

export function LandingRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPlan = (location.state as { plan?: string } | null)?.plan ?? 'trial';

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      setBusy(false);
      return;
    }

    const result = await registerTenant({
      businessName: businessName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      adminName: adminName.trim(),
      username: username.trim().toLowerCase(),
      password,
      plan: plan as 'trial' | 'starter' | 'business',
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? 'Kayıt oluşturulamadı.');
      return;
    }

    if (result.tenantId) {
      saveTenantId(result.tenantId);
    }

    navigate('/giris', {
      replace: true,
      state: {
        registered: true,
        username: result.username ?? username,
        message: 'Hesabınız oluşturuldu. Giriş yapabilirsiniz.',
      },
    });
  };

  return (
    <div className="landing-auth-page">
      <div className="landing-auth-card landing-auth-card--wide">
        <div className="landing-auth-head">
          <h1>Ücretsiz Deneme Başlat</h1>
          <p>14 gün boyunca tüm özellikleri deneyin — sıfırdan mağaza kurulumu</p>
        </div>

        <form className="landing-form-grid" onSubmit={handleSubmit}>
          <label>
            İşletme Adı
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Örn. Ekolojik Market Antalya"
              required
            />
          </label>

          <label>
            Yönetici Ad Soyad
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Adınız Soyadınız"
              required
            />
          </label>

          <label>
            E-posta
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
              required
            />
          </label>

          <label>
            Telefon
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
              required
            />
          </label>

          <label>
            Kullanıcı Adı
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="yonetici"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Şifre
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Plan
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="trial">Deneme — 14 gün ücretsiz</option>
              <option value="starter">Başlangıç — 499 ₺/ay</option>
              <option value="business">İşletme — 899 ₺/ay</option>
            </select>
          </label>

          {error && <p className="landing-flash landing-flash--error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
          </button>
        </form>

        <p className="landing-auth-switch">
          Zaten hesabınız var mı? <Link to="/giris">Giriş yapın</Link>
        </p>
      </div>
    </div>
  );
}
