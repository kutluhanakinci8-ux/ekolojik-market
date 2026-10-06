import { useNavigate } from 'react-router-dom';
import { PRICING_PLANS } from '../data/landingContent';

export function LandingPricing() {
  const navigate = useNavigate();

  const handleCta = (planId: string) => {
    if (planId === 'business') {
      navigate('/iletisim');
      return;
    }
    navigate('/kayit', { state: { plan: planId } });
  };

  return (
    <section className="landing-section">
      <div className="landing-section-head">
        <h2>Fiyatlandırma</h2>
        <p>Aylık kullanım modeli — ihtiyacınıza uygun planı seçin.</p>
      </div>
      <div className="landing-pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`landing-price-card ${plan.highlighted ? 'is-highlighted' : ''}`}
          >
            <h3>{plan.name}</h3>
            <p className="price-desc">{plan.description}</p>
            <div className="landing-price-amount">
              {plan.price === '0' ? 'Ücretsiz' : `${plan.price} ₺`}
              {plan.price !== '0' && <small> / {plan.period}</small>}
              {plan.price === '0' && <small> / {plan.period}</small>}
            </div>
            <ul className="landing-price-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleCta(plan.id)}
            >
              {plan.cta}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
