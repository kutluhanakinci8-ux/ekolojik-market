/**
 * Fatura e-posta altyapısı — IMAP bağlantı testi ve tarama iskeleti.
 * Gerçek IMAP entegrasyonu ileride bu modüle eklenecek.
 */

export async function testBillEmailConnection(config) {
  const host = String(config?.imapHost || '').trim();
  const user = String(config?.imapUser || config?.inboxAddress || '').trim();
  const password = String(config?.imapPassword || '').trim();
  const port = Number(config?.imapPort || 993);

  if (!user) {
    return { ok: false, message: 'E-posta adresi veya IMAP kullanıcı adı gerekli' };
  }

  if (!password) {
    return {
      ok: false,
      message: 'IMAP şifresi veya Gmail uygulama şifresi girin. Gmail için: Hesap → Güvenlik → 2 Adımlı Doğrulama → Uygulama şifreleri',
    };
  }

  if (!host) {
    return { ok: false, message: 'IMAP sunucu adresi gerekli (Gmail: imap.gmail.com)' };
  }

  // IMAP kütüphanesi henüz bağlanmadı — yapılandırma doğrulaması
  return {
    ok: true,
    message: `Yapılandırma kaydedildi. ${user}@${host}:${port} — IMAP tarama modülü bir sonraki aşamada aktif edilecek.`,
    mailboxCount: 0,
    pendingImplementation: true,
  };
}

export async function pollBillEmails(config) {
  const test = await testBillEmailConnection(config);
  if (!test.ok) {
    return { ok: false, message: test.message, processed: 0, items: [] };
  }

  const enabledSources = (config?.sources || []).filter((item) => item?.enabled);
  if (!enabledSources.length) {
    return {
      ok: true,
      message: 'Aktif fatura kaynağı yok. Ayarlardan kaynak ekleyin.',
      processed: 0,
      items: [],
    };
  }

  return {
    ok: true,
    message: `${enabledSources.length} kaynak için e-posta tarama kuyruğa alındı (IMAP modülü bekliyor)`,
    processed: 0,
    items: [],
    pendingImplementation: true,
  };
}
