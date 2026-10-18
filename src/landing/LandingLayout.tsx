import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAV_LINKS, SITE_NAME } from '../data/landingContent';

export function LandingLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="landing-root">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand" onClick={() => setMenuOpen(false)}>
            <span className="landing-brand-icon" aria-hidden>🌿</span>
            <span>{SITE_NAME}</span>
          </Link>

          <nav className={`landing-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Ana menü">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="landing-header-actions">
            <button
              type="button"
              className="landing-mobile-toggle"
              aria-label="Menü"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/giris')}>
              Giriş Yap
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/kayit')}>
              Ücretsiz Dene
            </button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <Outlet />
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <h4>{SITE_NAME}</h4>
            <p>
              Ekolojik ve doğal ürün mağazaları için bulut tabanlı satış noktası sistemi.
              Stok, kasa, müşteri ve muhasebe tek platformda.
            </p>
          </div>
          <div>
            <h4>Sayfalar</h4>
            {NAV_LINKS.map((item) => (
              <p key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </p>
            ))}
          </div>
          <div>
            <h4>Hesap</h4>
            <p><Link to="/giris">Giriş Yap</Link></p>
            <p><Link to="/kayit">Kayıt Ol</Link></p>
            <p><Link to="/fiyatlar">Fiyatlandırma</Link></p>
            <p><a href="mailto:info@ekolojikmarket.com.tr">info@ekolojikmarket.com.tr</a></p>
          </div>
        </div>
        <div className="landing-footer-bottom">
          © {new Date().getFullYear()} {SITE_NAME}. Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}
