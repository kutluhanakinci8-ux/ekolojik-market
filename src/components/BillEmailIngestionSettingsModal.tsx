import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import { pollBillEmails, testBillEmailConnection } from '../services/billEmailService';
import {
  BILL_EMAIL_INBOX_MODE_LABELS,
  BILL_EMAIL_PROVIDER_LABELS,
  BILL_EMAIL_PROVIDER_SENDER_HINTS,
  applyForwardingAliases,
  createBillEmailSource,
  type BillEmailInboxMode,
  type BillEmailProvider,
  type BillEmailSource,
} from '../types/billEmailIngestion';
import {
  PAYMENT_CATEGORY_LABELS,
  PAYMENT_SCOPE_LABELS,
  type PaymentReminderCategory,
  type PaymentScope,
} from '../types/paymentReminder';
import { SOLE_PROPRIETORSHIP_TAX_TEMPLATES } from '../utils/soleProprietorshipTaxCalendar';

interface BillEmailIngestionSettingsModalProps {
  open: boolean;
  store: Store;
  onClose: () => void;
  onMessage: (message: string) => void;
}

const PROVIDERS = Object.keys(BILL_EMAIL_PROVIDER_LABELS) as BillEmailProvider[];
const INBOX_MODES = Object.keys(BILL_EMAIL_INBOX_MODE_LABELS) as BillEmailInboxMode[];
const CATEGORIES = Object.keys(PAYMENT_CATEGORY_LABELS) as PaymentReminderCategory[];

function formatTime(value?: string) {
  if (!value) return 'Henüz çalışmadı';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BillEmailIngestionSettingsModal({
  open,
  store,
  onClose,
  onMessage,
}: BillEmailIngestionSettingsModalProps) {
  const saved = store.settings.billEmailIngestion;
  const taxSaved = store.settings.soleProprietorshipTaxCalendar;
  const [draft, setDraft] = useState(saved);
  const [taxDraft, setTaxDraft] = useState(taxSaved);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(saved);
      setTaxDraft(taxSaved);
      setStatus(null);
    }
  }, [open, saved, taxSaved]);

  const preview = useMemo(() => applyForwardingAliases(draft), [draft]);

  if (!open) return null;

  const updateDraft = (patch: Partial<typeof draft>) => {
    setDraft((prev) => applyForwardingAliases({ ...prev, ...patch }));
  };

  const updateSource = (id: string, patch: Partial<BillEmailSource>) => {
    setDraft((prev) => applyForwardingAliases({
      ...prev,
      sources: prev.sources.map((item) => (
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      )),
    }));
  };

  const copyText = async (text: string, label: string) => {
    if (!text) {
      onMessage(`${label} henüz oluşturulmadı — önce ana e-posta adresini girin`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onMessage(`${label} kopyalandı`);
    } catch {
      onMessage(`${label}: ${text}`);
    }
  };

  const handleSave = () => {
    const next = applyForwardingAliases(draft);
    store.updateBillEmailIngestionSettings(next);
    store.updateSoleProprietorshipTaxCalendarSettings(taxDraft);
    const taxResult = store.ensureSoleProprietorshipTaxReminders();
    onMessage(taxResult.added > 0
      ? `Ayarlar kaydedildi · ${taxResult.message}`
      : 'Ödeme takvimi ayarları kaydedildi');
    onClose();
  };

  const handleRefreshTaxCalendar = () => {
    store.updateSoleProprietorshipTaxCalendarSettings(taxDraft);
    const result = store.ensureSoleProprietorshipTaxReminders();
    setStatus(result.message);
    onMessage(result.message);
  };

  const handleTest = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await testBillEmailConnection(preview);
      setStatus(result.message);
      setDraft((prev) => ({
        ...prev,
        lastPollAt: new Date().toISOString(),
        lastPollOk: result.ok,
        lastPollError: result.ok ? undefined : result.message,
        lastPollMessage: result.message,
      }));
    } finally {
      setBusy(false);
    }
  };

  const handlePoll = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await pollBillEmails(preview);
      setStatus(result.message);
      setDraft((prev) => ({
        ...prev,
        lastPollAt: new Date().toISOString(),
        lastPollOk: result.ok,
        lastPollError: result.ok ? undefined : result.message,
        lastPollMessage: result.message,
      }));
      if (result.ok) onMessage(result.message);
    } finally {
      setBusy(false);
    }
  };

  const addSource = () => {
    setDraft((prev) => applyForwardingAliases({
      ...prev,
      sources: [
        ...prev.sources,
        createBillEmailSource({
          label: 'Yeni Fatura Kaynağı',
          provider: 'generic',
          scope: 'company',
          category: 'other',
          aliasTag: `fatura-${prev.sources.length + 1}`,
          enabled: true,
        }),
      ],
    }));
  };

  const removeSource = (id: string) => {
    setDraft((prev) => applyForwardingAliases({
      ...prev,
      sources: prev.sources.filter((item) => item.id !== id),
    }));
  };

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bill-email-settings-title">
      <div className="security-modal-card security-modal-card--wide bill-email-settings-modal">
        <div className="bill-email-settings-header">
          <div>
            <h2 id="bill-email-settings-title">Ödeme Takvimi Ayarları</h2>
            <p className="security-modal-hint">
              Fatura e-posta aktarımı ve şahıs firması vergi ödeme tarihleri buradan yönetilir.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>Kapat</button>
        </div>

        <section className="bill-email-settings-section">
          <h3>1. Gelen kutusu</h3>
          <div className="settings-form-grid">
            <label className="settings-field">
              <span className="settings-field-label-row">
                Otomatik fatura okuma
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => updateDraft({ enabled: e.target.checked })}
                />
              </span>
            </label>
            <label className="settings-field">
              Bağlantı türü
              <select
                value={draft.inboxMode}
                onChange={(e) => updateDraft({ inboxMode: e.target.value as BillEmailInboxMode })}
              >
                {INBOX_MODES.map((mode) => (
                  <option key={mode} value={mode}>{BILL_EMAIL_INBOX_MODE_LABELS[mode]}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              Ana e-posta adresi
              <input
                value={draft.inboxAddress}
                onChange={(e) => updateDraft({ inboxAddress: e.target.value })}
                placeholder="ornek@gmail.com"
                autoComplete="email"
              />
            </label>
            <label className="settings-field">
              Tarama aralığı (dakika)
              <input
                type="number"
                min={5}
                max={1440}
                value={draft.pollIntervalMin}
                onChange={(e) => updateDraft({ pollIntervalMin: Number(e.target.value) || 30 })}
              />
            </label>
          </div>

          {draft.inboxMode === 'plus_alias' && (
            <p className="module-hint bill-email-settings-note">
              <strong>Gmail + alias:</strong> Mevcut adresinize dokunmadan{' '}
              <code>adres+etiket@gmail.com</code> oluşturulur.
              ASAT ve diğer kurum profillerine bu özel adresi yazın.
            </p>
          )}

          {draft.inboxMode === 'dedicated_gmail' && (
            <p className="module-hint bill-email-settings-note">
              <strong>Özel Gmail:</strong> Sadece faturalar için yeni bir Gmail açın
              (örn. <code>isletme.fatura@gmail.com</code>). Tüm kurumlara aynı adresi yazın.
            </p>
          )}

          <details className="bill-email-imap-details">
            <summary>IMAP / Gmail uygulama şifresi</summary>
            <div className="settings-form-grid">
              <label className="settings-field">
                IMAP sunucu
                <input
                  value={draft.imapHost}
                  onChange={(e) => updateDraft({ imapHost: e.target.value })}
                  placeholder="imap.gmail.com"
                />
              </label>
              <label className="settings-field">
                Port
                <input
                  type="number"
                  value={draft.imapPort}
                  onChange={(e) => updateDraft({ imapPort: Number(e.target.value) || 993 })}
                />
              </label>
              <label className="settings-field">
                IMAP kullanıcı
                <input
                  value={draft.imapUser}
                  onChange={(e) => updateDraft({ imapUser: e.target.value })}
                  placeholder={draft.inboxAddress || 'boş = ana adres'}
                />
              </label>
              <label className="settings-field">
                Uygulama şifresi
                <input
                  type="password"
                  value={draft.imapPassword}
                  onChange={(e) => updateDraft({ imapPassword: e.target.value })}
                  placeholder="Gmail uygulama şifresi"
                  autoComplete="new-password"
                />
              </label>
            </div>
          </details>
        </section>

        <section className="bill-email-settings-section">
          <div className="bill-email-sources-header">
            <h3>2. Kurum adresleri</h3>
            <button type="button" className="btn btn-sm btn-outline" onClick={addSource}>+ Kaynak Ekle</button>
          </div>

          <ul className="bill-email-sources-list">
            {preview.sources.map((source) => (
              <li key={source.id} className="bill-email-source-card">
                <div className="settings-form-grid">
                  <label className="settings-field">
                    Ad
                    <input
                      value={source.label}
                      onChange={(e) => updateSource(source.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="settings-field">
                    Kurum
                    <select
                      value={source.provider}
                      onChange={(e) => {
                        const provider = e.target.value as BillEmailProvider;
                        updateSource(source.id, {
                          provider,
                          senderFilter: BILL_EMAIL_PROVIDER_SENDER_HINTS[provider] || source.senderFilter,
                        });
                      }}
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>{BILL_EMAIL_PROVIDER_LABELS[provider]}</option>
                      ))}
                    </select>
                  </label>
                  {draft.inboxMode === 'plus_alias' && (
                    <label className="settings-field">
                      Alias etiketi
                      <input
                        value={source.aliasTag || ''}
                        onChange={(e) => updateSource(source.id, { aliasTag: e.target.value })}
                        placeholder="asat-ev"
                      />
                    </label>
                  )}
                  <label className="settings-field">
                    Yer
                    <select
                      value={source.scope}
                      onChange={(e) => updateSource(source.id, { scope: e.target.value as PaymentScope })}
                    >
                      {Object.entries(PAYMENT_SCOPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    Kategori
                    <select
                      value={source.category}
                      onChange={(e) => updateSource(source.id, { category: e.target.value as PaymentReminderCategory })}
                    >
                      {CATEGORIES.map((key) => (
                        <option key={key} value={key}>{PAYMENT_CATEGORY_LABELS[key]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    Sözleşme / abone no
                    <input
                      value={source.contractNumber || ''}
                      onChange={(e) => updateSource(source.id, { contractNumber: e.target.value })}
                      placeholder="Opsiyonel"
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label-row">
                      Aktif
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={(e) => updateSource(source.id, { enabled: e.target.checked })}
                      />
                    </span>
                  </label>
                </div>

                <div className="bill-email-alias-row">
                  <div>
                    <span className="module-hint">Kurum profiline yazılacak adres</span>
                    <strong className="bill-email-alias-value">{source.forwardingAlias || '—'}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => copyText(source.forwardingAlias, source.label)}
                  >
                    Kopyala
                  </button>
                </div>

                {preview.sources.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-soft bill-email-remove-btn"
                    onClick={() => removeSource(source.id)}
                  >
                    Kaynağı Sil
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="bill-email-settings-section">
          <div className="bill-email-sources-header">
            <h3>3. Şahıs firması vergi takvimi</h3>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleRefreshTaxCalendar}
            >
              Vergi Takvimini Yenile
            </button>
          </div>

          <div className="settings-form-grid">
            <label className="settings-field">
              <span className="settings-field-label-row">
                Otomatik vergi hatırlatıcıları
                <input
                  type="checkbox"
                  checked={taxDraft.enabled}
                  onChange={(e) => setTaxDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
              </span>
            </label>
            <label className="settings-field">
              <span className="settings-field-label-row">
                Muhtasar / stopaj
                <input
                  type="checkbox"
                  checked={taxDraft.includeMuhtasar}
                  onChange={(e) => setTaxDraft((prev) => ({ ...prev, includeMuhtasar: e.target.checked }))}
                  disabled={!taxDraft.enabled}
                />
              </span>
            </label>
            <label className="settings-field">
              <span className="settings-field-label-row">
                Ba-Bs formları
                <input
                  type="checkbox"
                  checked={taxDraft.includeBaBs}
                  onChange={(e) => setTaxDraft((prev) => ({ ...prev, includeBaBs: e.target.checked }))}
                  disabled={!taxDraft.enabled}
                />
              </span>
            </label>
            <label className="settings-field">
              <span className="settings-field-label-row">
                SGK prim (personel)
                <input
                  type="checkbox"
                  checked={taxDraft.includeSgk}
                  onChange={(e) => setTaxDraft((prev) => ({ ...prev, includeSgk: e.target.checked }))}
                  disabled={!taxDraft.enabled}
                />
              </span>
            </label>
          </div>

          <ul className="bill-email-tax-preview">
            {SOLE_PROPRIETORSHIP_TAX_TEMPLATES.map((item) => {
              const optionalOff = item.optional && (
                (item.slug === 'muhtasar' && !taxDraft.includeMuhtasar)
                || (item.slug === 'babs' && !taxDraft.includeBaBs)
                || (item.slug === 'sgk-prim' && !taxDraft.includeSgk)
              );
              if (!taxDraft.enabled || optionalOff) return null;
              const schedule = item.recurrence === 'monthly'
                ? (item.monthlyDay === 'last' ? 'Her ayın son günü' : `Her ayın ${item.monthlyDay}. günü`)
                : `${item.yearlyDay}. ${['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][item.yearlyMonth ?? 0]}`;
              return (
                <li key={item.slug}>
                  <strong>{item.title}</strong>
                  <span className="module-hint">{schedule} · {item.recurrence === 'monthly' ? 'Aylık' : 'Yıllık'}</span>
                </li>
              );
            })}
          </ul>
          <p className="module-hint">
            Son güncelleme: {formatTime(taxDraft.lastSeededAt)}
            {' · '}Hafta sonuna denk gelen vadeler ilk iş gününe kaydırılır.
          </p>
        </section>

        <section className="bill-email-settings-section">
          <h3>4. E-posta kurulum rehberi</h3>
          <ol className="bill-email-setup-steps">
            <li>Ana e-posta adresini ve bağlantı türünü seçin.</li>
            <li>Her kurum için oluşan adresi kopyalayın.</li>
            <li>ASAT / CK Akdeniz vb. online portal → Profil → E-posta alanına yapıştırın.</li>
            <li>IMAP uygulama şifresini girin ve bağlantıyı test edin.</li>
            <li>Sistem periyodik olarak gelen kutusunu tarayıp takvime işleyecek.</li>
          </ol>
          <p className="module-hint">
            Son tarama: {formatTime(preview.lastPollAt)}
            {preview.lastPollMessage ? ` · ${preview.lastPollMessage}` : ''}
            {preview.lastPollError ? ` · Hata: ${preview.lastPollError}` : ''}
          </p>
        </section>

        {status && <p className="settings-flash" role="status">{status}</p>}

        <div className="payment-calendar-form-actions bill-email-settings-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>İptal</button>
          <button type="button" className="btn btn-outline" onClick={() => void handleTest()} disabled={busy}>
            Bağlantıyı Test Et
          </button>
          <button type="button" className="btn btn-outline" onClick={() => void handlePoll()} disabled={busy || !preview.enabled}>
            Şimdi Tara
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
