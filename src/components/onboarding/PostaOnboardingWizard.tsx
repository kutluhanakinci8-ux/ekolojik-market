import { useCallback, useEffect, useState } from 'react';
import { sendEmailTest } from '../../services/emailOutboxService';
import { loadTenantId } from '../../storage/tenantSession';
import {
  buildMessagingEmbedSnippet,
  completePostaOnboarding,
  fetchMessagingPublicConfig,
  fetchPostaOnboardingHub,
  patchPostaOnboarding,
  rotateMessagingPublicKey,
  type MessagingPublicConfigHub,
  type PostaOnboardingHub,
} from '../../services/postaOnboardingService';
import type { useStore } from '../../store/useStore';

type Props = {
  store: ReturnType<typeof useStore>;
  onFinished: () => void;
};

const STEPS = [
  { id: 'mailHealth' as const, title: 'E-posta altyapısı', subtitle: 'SMTP / IMAP ve işletme kutusu' },
  { id: 'messagingEmbed' as const, title: 'Mesajlaşma', subtitle: 'Web sitesine sohbet widget’ı' },
  { id: 'postaTab' as const, title: 'Posta sekmesi', subtitle: 'Yetki ve kurulumu bitir' },
];

export function PostaOnboardingWizard({ store, onFinished }: Props) {
  const [hub, setHub] = useState<PostaOnboardingHub | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [messagingConfig, setMessagingConfig] = useState<MessagingPublicConfigHub | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchPostaOnboardingHub();
    if (next) {
      setHub(next);
      if (next.onboarding.registrationEmail && !testTo) {
        setTestTo(next.onboarding.registrationEmail);
      }
    }
  }, [testTo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (stepIndex !== 1) return;
    void (async () => {
      const cfg = await fetchMessagingPublicConfig();
      if (cfg) setMessagingConfig(cfg);
    })();
  }, [stepIndex]);

  const step = STEPS[stepIndex];
  const onboarding = hub?.onboarding;
  const summary = hub?.summary;

  const patchStep = async (stepId: typeof STEPS[number]['id'], patch: { done?: boolean; skipped?: boolean }) => {
    setBusy(true);
    setFlash(null);
    const result = await patchPostaOnboarding({
      status: 'in_progress',
      steps: { [stepId]: patch },
    });
    setBusy(false);
    if (!result.ok) {
      setFlash('Kaydedilemedi — tekrar deneyin.');
      return;
    }
    await reload();
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  };

  const handleDismiss = async () => {
    setBusy(true);
    await patchPostaOnboarding({ status: 'dismissed' });
    setBusy(false);
    onFinished();
  };

  const handleFinish = async () => {
    setBusy(true);
    setFlash(null);
    const result = await completePostaOnboarding({ primaryOnly: true, skipIncompleteSteps: true });
    if (!result.ok) {
      setBusy(false);
      setFlash('Kurulum tamamlanamadı.');
      return;
    }
    await store.refreshTenantData();
    setBusy(false);
    onFinished();
  };

  const handleTestMail = async () => {
    const to = testTo.trim();
    if (!to.includes('@')) {
      setFlash('Geçerli bir test e-posta adresi girin.');
      return;
    }
    setBusy(true);
    const result = await sendEmailTest({ to, subject: 'Ekolojik Posta test', body: 'Kurulum test mesajı.' });
    setBusy(false);
    if (!result.ok) {
      setFlash(result.error ?? 'Test gönderilemedi.');
      return;
    }
    setFlash('Test e-postası kuyruğa alındı.');
    await patchStep('mailHealth', { done: true });
  };

  if (!hub || !onboarding || !summary) {
    return (
      <div className="posta-onboarding-backdrop" role="dialog" aria-modal="true">
        <div className="posta-onboarding-card">
          <p>Kurulum yükleniyor…</p>
        </div>
      </div>
    );
  }

  const tenantId = loadTenantId();
  const apiKeyForEmbed =
    messagingConfig?.publicKey ||
    (messagingConfig?.effectiveSource === 'env' ? '(sunucu .env EKOLOJIK_MESSAGING_PUBLIC_KEY)' : '');
  const embedSnippet = buildMessagingEmbedSnippet(tenantId, messagingConfig?.publicKey ?? '');

  const handleRotateKey = async () => {
    setBusy(true);
    setFlash(null);
    const cfg = await rotateMessagingPublicKey();
    setBusy(false);
    if (!cfg) {
      setFlash('Anahtar oluşturulamadı.');
      return;
    }
    setMessagingConfig(cfg);
    setFlash('Yeni API anahtarı oluşturuldu — embed kodunu güncelleyin.');
    await reload();
  };

  return (
    <div className="posta-onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="posta-onboarding-title">
      <div className="posta-onboarding-card">
        <header className="posta-onboarding-head">
          <h1 id="posta-onboarding-title">Posta ve mesajlaşma kurulumu</h1>
          <p>3 adımda işletme e-postası ve müşteri sohbetini hazırlayın.</p>
        </header>

        <ol className="posta-onboarding-steps" aria-label="Kurulum adımları">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i === stepIndex ? 'is-active' : i < stepIndex ? 'is-done' : ''}>
              <span className="posta-onboarding-steps__num">{i + 1}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>

        <section className="posta-onboarding-body">
          {step.id === 'mailHealth' && (
            <>
              <p className="posta-onboarding-lead">
                Kayıt e-postanız <strong>kişisel kutu değil</strong>, işletme iletişim adresinizdir. Gelen kutusu sunucudaki
                ortak hesaptır (ör. <code>info@…</code>).
              </p>
              <ul className="posta-onboarding-checklist">
                <li className={summary.mailHealth.smtpVerified ? 'ok' : 'warn'}>
                  SMTP: {summary.mailHealth.smtpConfigured ? (summary.mailHealth.smtpVerified ? 'Hazır' : 'Yapılandırılmış, doğrulama başarısız') : 'Yapılandırılmamış'}
                </li>
                <li className={summary.mailHealth.imapConfigured ? 'ok' : 'warn'}>
                  IMAP: {summary.mailHealth.imapConfigured ? 'Yapılandırılmış' : 'Yapılandırılmamış'}
                </li>
              </ul>
              <label className="posta-onboarding-field">
                Test e-postası gönder
                <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="ornek@firma.com" />
              </label>
              <div className="posta-onboarding-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleTestMail()}>
                  Test gönder ve devam
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void patchStep('mailHealth', { skipped: true })}>
                  Sunucu yöneticisi hallediyor
                </button>
              </div>
            </>
          )}

          {step.id === 'messagingEmbed' && (
            <>
              <p className="posta-onboarding-lead">
                Müşteriler sitenizden yazabilir; mesajlar POS <strong>Posta → Müşteri mesajları</strong> altında görünür.
              </p>
              <p className={`posta-onboarding-status ${summary.messaging.publicApiConfigured ? 'ok' : 'warn'}`}>
                Public API:{' '}
                {summary.messaging.publicApiConfigured
                  ? messagingConfig?.hasTenantKey
                    ? `Mağaza anahtarı (${messagingConfig.publicKeyMasked})`
                    : messagingConfig?.effectiveSource === 'env'
                      ? 'Sunucu genel anahtarı (.env)'
                      : 'Açık'
                  : 'Kapalı — anahtar oluşturun veya .env tanımlayın'}
              </p>
              {!messagingConfig?.configured && (
                <div className="posta-onboarding-actions">
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleRotateKey()}>
                    Mağaza API anahtarı oluştur
                  </button>
                </div>
              )}
              {messagingConfig?.hasTenantKey && (
                <p className="posta-onboarding-lead">
                  API anahtarı: <code>{messagingConfig.publicKey}</code>
                </p>
              )}
              {messagingConfig?.effectiveSource === 'env' && !messagingConfig.hasTenantKey && (
                <p className="posta-onboarding-lead">
                  Bu sunucu <code>EKOLOJIK_MESSAGING_PUBLIC_KEY</code> kullanıyor; embed’de o değeri yazın veya mağazaya özel anahtar oluşturun.
                </p>
              )}
              <label className="posta-onboarding-field">
                Site embed örneği
                <textarea readOnly rows={7} value={embedSnippet} onFocus={(e) => e.target.select()} />
              </label>
              {apiKeyForEmbed && !messagingConfig?.publicKey && (
                <p className="posta-onboarding-lead" style={{ fontSize: '0.85rem' }}>Anahtar: {apiKeyForEmbed}</p>
              )}
              <div className="posta-onboarding-actions">
                {messagingConfig?.hasTenantKey && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleRotateKey()}>
                    Anahtarı yenile
                  </button>
                )}
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void patchStep('messagingEmbed', { done: true })}>
                  Kodu kopyaladım / devam
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void patchStep('messagingEmbed', { skipped: true })}>
                  Sadece POS içi sohbet
                </button>
              </div>
            </>
          )}

          {step.id === 'postaTab' && (
            <>
              <p className="posta-onboarding-lead">
                Birincil yöneticiye <strong>Posta</strong> sekmesi verilir. Diğer kullanıcılar için Ayarlar → Kullanıcılar.
              </p>
              <p className={`posta-onboarding-status ${summary.postaTabGranted ? 'ok' : 'warn'}`}>
                Posta sekmesi: {summary.postaTabGranted ? 'Zaten açık' : 'Kurulum bitince açılacak'}
              </p>
              <div className="posta-onboarding-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleFinish()}>
                  Kurulumu bitir
                </button>
                {stepIndex > 0 && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStepIndex((i) => i - 1)}>
                    Geri
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {flash && <p className="posta-onboarding-flash" role="status">{flash}</p>}

        <footer className="posta-onboarding-foot">
          <button type="button" className="posta-onboarding-link" disabled={busy} onClick={() => void handleDismiss()}>
            Sonra hatırlat
          </button>
        </footer>
      </div>
    </div>
  );
}
