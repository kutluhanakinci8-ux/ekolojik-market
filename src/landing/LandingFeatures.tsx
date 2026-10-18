import { FEATURES } from '../data/landingContent';

export function LandingFeatures() {
  return (
    <section className="landing-section">
      <div className="landing-section-head">
        <h2>Özellikler</h2>
        <p>Ekolojik market işletmeniz için ihtiyacınız olan tüm araçlar tek platformda.</p>
      </div>
      <div className="landing-features-grid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="landing-feature-card">
            <div className="landing-feature-icon" aria-hidden>{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
