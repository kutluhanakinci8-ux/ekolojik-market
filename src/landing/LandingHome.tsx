import { useNavigate } from 'react-router-dom';
import { FEATURES, HERO_PREVIEW, SITE_TAGLINE, STATS } from '../data/landingContent';

export function LandingHome() {
  const navigate = useNavigate();

  return (
    <>
      <section className="landing-hero">
        <div>
          <span className="landing-hero-badge">🌱 Ekolojik ürün mağazaları için</span>
          <h1>
            Mağazanızı <span>tek panelden</span> yönetin
          </h1>
          <p className="landing-hero-lead">{SITE_TAGLINE}</p>
          <div className="landing-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/kayit')}>
              14 Gün Ücretsiz Dene
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/giris')}>
              Mevcut Hesabımla Giriş
            </button>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-mock-panel">
            <div className="landing-mock-header">{HERO_PREVIEW.title}</div>
            <div className="landing-mock-body">
              {HERO_PREVIEW.items.map((item) => (
                <div key={item.label} className="landing-mock-row landing-mock-row--feature">
                  <span className="landing-mock-feature">
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="landing-mock-check" aria-hidden>✓</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-stats" aria-label="Özet istatistikler">
        {STATS.map((stat) => (
          <div key={stat.label} className="landing-stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <h2>Neden Ekolojik Market POS?</h2>
          <p>Doğal ürün satışına özel modüller ile kasadan raporlara her şey elinizin altında.</p>
        </div>
        <div className="landing-features-grid">
          {FEATURES.slice(0, 4).map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <div className="landing-feature-icon" aria-hidden>{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Hemen denemeye başlayın</h2>
        <p>14 gün ücretsiz, kredi kartı gerekmez. Mevcut Greenleaf kullanıcıları kayıtlı bilgileriyle giriş yapabilir.</p>
        <button type="button" className="btn" onClick={() => navigate('/kayit')}>
          Ücretsiz Hesap Oluştur
        </button>
      </section>
    </>
  );
}
