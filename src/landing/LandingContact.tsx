import { useState } from 'react';
import { submitContactForm } from '../services/authApi';

export function LandingContact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('genel');
  const [message, setMessage] = useState('');
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFlash(null);
    setPortalUrl(null);
    setReference(null);
    const result = await submitContactForm({ name, email, phone, subject, message });
    setBusy(false);
    if (result.ok) {
      setFlash({ type: 'success', text: result.message ?? 'Mesajınız alındı.' });
      setPortalUrl(result.portalUrl ?? null);
      setReference(result.reference ?? null);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } else {
      setFlash({ type: 'error', text: result.message ?? 'Gönderilemedi.' });
    }
  };

  return (
    <section className="landing-section">
      <div className="landing-section-head">
        <h2>İletişim</h2>
        <p>Sorularınız, demo talebi veya işletme planı için bize yazın.</p>
      </div>

      <div className="landing-contact-grid">
        <div className="landing-contact-info">
          <div className="landing-contact-item">
            <strong>E-posta</strong>
            <span>info@ekolojikmarket.com.tr</span>
          </div>
          <div className="landing-contact-item">
            <strong>Destek</strong>
            <span>destek@ekolojikmarket.com.tr</span>
          </div>
          <div className="landing-contact-item">
            <strong>Çalışma Saatleri</strong>
            <span>Pazartesi – Cuma, 09:00 – 18:00</span>
          </div>
          <div className="landing-contact-item">
            <strong>Deneme</strong>
            <span>14 gün ücretsiz deneme için kayıt formunu kullanabilirsiniz.</span>
          </div>
        </div>

        <form className="landing-contact-form landing-form-grid" onSubmit={handleSubmit}>
          {flash && (
            <p className={`landing-flash landing-flash--${flash.type}`} role="alert">{flash.text}</p>
          )}
          {portalUrl && (
            <p className="landing-flash landing-flash--success" role="status">
              Talebinizi takip edin:{' '}
              <a href={portalUrl}>Müşteri portalı</a>
              {reference ? ` (referans: ${reference})` : ''}
            </p>
          )}
          <label>
            Ad Soyad
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            E-posta
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Telefon
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Konu
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="genel">Genel Bilgi</option>
              <option value="demo">Demo Talebi</option>
              <option value="fiyat">Fiyatlandırma</option>
              <option value="destek">Teknik Destek</option>
            </select>
          </label>
          <label>
            Mesaj
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Gönderiliyor...' : 'Mesaj Gönder'}
          </button>
        </form>
      </div>
    </section>
  );
}
