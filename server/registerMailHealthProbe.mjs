/** Kayıt sonrası — tenant posta sağlığı (async, hata yutulur) */

import { readTenantStore } from './tenantAuth.mjs';

export async function probeTenantMailHealthAfterRegister(dataDir, tenantId) {
  const store = await readTenantStore(dataDir, tenantId);
  const email = store?.settings?.postaOnboarding?.registrationEmail;
  const summary = { tenantId, smtp: null, imap: null, at: new Date().toISOString() };

  try {
    const { getTenantMailConfigHub } = await import('./tenantMailConfig.mjs');
    const cfg = await getTenantMailConfigHub(dataDir, tenantId);
    summary.smtp = Boolean(cfg?.smtpConfigured);
    summary.imap = Boolean(cfg?.imapConfigured);
  } catch {
    summary.smtp = false;
    summary.imap = false;
  }

  if (email?.includes('@')) {
    try {
      const { enqueueEkolojikMail } = await import('./emailOutbox.mjs');
      await enqueueEkolojikMail(dataDir, {
        to: email,
        subject: 'Ekolojik — hesabınız oluşturuldu',
        text: [
          'Hesabınız başarıyla oluşturuldu.',
          '',
          'İlk girişte Posta kurulum sihirbazı açılacaktır. İşletme e-posta kutusu (IMAP/SMTP) henüz bağlanmadıysa sihirbaz adımlarını tamamlayın.',
          '',
          `Mağaza kodu: ${tenantId}`,
        ].join('\n'),
        tenantId,
        source: 'register-welcome',
        idempotencyKey: `register:welcome:${tenantId}`,
      });
    } catch {
      /* opsiyonel */
    }
  }

  return summary;
}

export function scheduleRegisterMailHealthProbe(dataDir, tenantId) {
  void probeTenantMailHealthAfterRegister(dataDir, tenantId).catch(() => {});
}
