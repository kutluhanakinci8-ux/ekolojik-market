import { useCallback, useEffect, useRef, useState } from 'react';
import { sendEmailTest } from '../../services/emailOutboxService';
import { fetchPostaDeliverability } from '../../services/postaSettingsService';
import { fetchTenantMailConfig, saveTenantMailConfig } from '../../services/postaTenantMailService';
import { loadTenantId } from '../../storage/tenantSession';
import {
  buildMessagingEmbedSnippet,
  completePostaOnboarding,
  fetchMessagingPublicConfig,
  fetchPostaOnboardingHub,
  patchPostaOnboarding,
  rotateMessagingPublicKey,
  saveMessagingAllowedOrigins,
  seedPostaOnboardingAliasRules,
  testMessagingWidgetSmoke,
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
  const [mailAliases, setMailAliases] = useState<string[]>([]);
  const [usePlatformEnv, setUsePlatformEnv] = useState(true);
  const [tenantImapHost, setTenantImapHost] = useState('');
  const [tenantImapUser, setTenantImapUser] = useState('');
  const [tenantSmtpFrom, setTenantSmtpFrom] = useState('');
  const [siteOrigin, setSiteOrigin] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com',
  );
  const [widgetTestOk, setWidgetTestOk] = useState(false);
  const widgetScriptLoaded = useRef(false);

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
    if (stepIndex !== 0) return;
    void (async () => {
      const d = await fetchPostaDeliverability();
      if (d?.aliases?.length) setMailAliases(d.aliases);
      const tm = await fetchTenantMailConfig();
      const hubNow = await fetchPostaOnboardingHub();
      if (tm?.ok) {
        setUsePlatformEnv(tm.usePlatformEnv);
        setTenantImapHost(tm.imap.host ?? '');
        setTenantImapUser(tm.imap.user ?? '');
        setTenantSmtpFrom(tm.smtp.from ?? hubNow?.onboarding.registrationEmail ?? '');
      }
    })();
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex !== 1) return;
    void (async () => {
      const cfg = await fetchMessagingPublicConfig();
      if (cfg) {
        setMessagingConfig(cfg);
        if (cfg.allowedOrigins?.length) setSiteOrigin(cfg.allowedOrigins[0]);
      }
    })();
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex !== 1 || !messagingConfig?.publicKey || widgetScriptLoaded.current) return;
    const mountId = 'ek-onboarding-widget-preview';
    const el = document.getElementById(mountId);
    if (!el) return;
    const tenant = loadTenantId();
    const script = document.createElement('script');
    script.src = '/widget/messaging.js';
    script.async = true;
    script.onload = () => {
      widgetScriptLoaded.current = true;
      const api = (window as unknown as { EkolojikMessaging?: { init: (c: Record<string, string>) => void } })
        .EkolojikMessaging;
      api?.init({
        mount: mountId,
        tenantId: tenant || 'main',
        apiKey: messagingConfig.publicKey,
        apiBase: `${window.location.origin}/api/public/messaging/v1`,
        title: 'Widget önizleme',
        position: 'left',
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
      widgetScriptLoaded.current = false;
      el.innerHTML = '';
    };
  }, [stepIndex, messagingConfig?.publicKey]);

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

  const handleSeedAliasRules = async () => {
    setBusy(true);
    setFlash(null);
    const result = await seedPostaOnboardingAliasRules();
    setBusy(false);
    if (!result.ok) {
      setFlash('Kurallar eklenemedi.');
      return;
    }
    const count = result.added?.length ?? 0;
    setFlash(count ? `${count} kural eklendi (siparis@ / fatura@).` : 'Kurallar zaten tanımlı.');
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

  const handleWidgetTest = async () => {
    const origin = siteOrigin.trim();
    if (!origin.startsWith('http')) {
      setFlash('Site kökeni https://… formatında olmalı (CORS).');
      return;
    }
    if (!messagingConfig?.configured && !messagingConfig?.publicKey) {
      setFlash('Önce API anahtarı oluşturun.');
      return;
    }
    setBusy(true);
    setFlash(null);
    await saveMessagingAllowedOrigins([origin]);
    const result = await testMessagingWidgetSmoke();
    setBusy(false);
    if (!result.ok) {
      setFlash(result.error ?? 'Widget testi başarısız.');
      setWidgetTestOk(false);
      return;
    }
    setWidgetTestOk(true);
    setFlash('Widget testi OK — POS Posta → Müşteri mesajlarında test yazışmasını görebilirsiniz.');
    const cfg = await fetchMessagingPublicConfig();
    if (cfg) setMessagingConfig(cfg);
  };

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
              <p className="posta-onboarding-lead" style={{ fontSize: '0.9rem' }}>
                Önerilen alias’lar (hosting veya <code>EKOLOJIK_MAIL_ALIASES</code>):{' '}
                {mailAliases.length ? mailAliases.join(', ') : 'siparis@, fatura@ → aynı IMAP kutusu'}
              </p>
              <div className="posta-onboarding-actions">
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleSeedAliasRules()}>
                  siparis@ / fatura@ kurallarını ekle
                </button>
              </div>
              <label className="posta-onboarding-lead" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={usePlatformEnv} onChange={(e) => setUsePlatformEnv(e.target.checked)} />
                Platform .env (paylaşımlı kutu)
              </label>
              {!usePlatformEnv && (
                <div className="posta-onboarding-field">
                  <input placeholder="IMAP host" value={tenantImapHost} onChange={(e) => setTenantImapHost(e.target.value)} />
                  <input placeholder="IMAP kullanıcı" value={tenantImapUser} onChange={(e) => setTenantImapUser(e.target.value)} />
                  <input placeholder="Gönderen From" value={tenantSmtpFrom} onChange={(e) => setTenantSmtpFrom(e.target.value)} />
                </div>
              )}
              {!usePlatformEnv && (
                <div className="posta-onboarding-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const saved = await saveTenantMailConfig({
                        usePlatformEnv: false,
                        imap: { host: tenantImapHost.trim(), user: tenantImapUser.trim() },
                        smtp: { from: tenantSmtpFrom.trim() || testTo.trim() },
                      });
                      setBusy(false);
                      if (!saved) {
                        setFlash('Mağaza posta ayarı kaydedilemedi.');
                        return;
                      }
                      setFlash('Mağaza kutusu kaydedildi.');
                      await reload();
                    }}
                  >
                    Mağaza kutusunu kaydet
                  </button>
                </div>
              )}
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
                Web sitesi kökeni (CORS allowlist)
                <input
                  type="url"
                  value={siteOrigin}
                  onChange={(e) => setSiteOrigin(e.target.value)}
                  placeholder="https://magaza-siteniz.com"
                />
              </label>
              <p className="posta-onboarding-lead" style={{ fontSize: '0.85rem' }}>
                Harici sitelerde widget için bu adresi kaydedin; POS önizleme aynı kökende çalışır.
              </p>
              <label className="posta-onboarding-field">
                Site embed örneği
                <textarea readOnly rows={9} value={embedSnippet} onFocus={(e) => e.target.select()} />
              </label>
              <div id="ek-onboarding-widget-preview" className="posta-onboarding-widget-preview" aria-label="Widget önizleme alanı" />
              <div className="posta-onboarding-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || !messagingConfig?.configured}
                  onClick={() => void handleWidgetTest()}
                >
                  Widget bağlantısını test et
                </button>
                {widgetTestOk && <span className="posta-onboarding-status ok">Test geçti</span>}
              </div>
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
