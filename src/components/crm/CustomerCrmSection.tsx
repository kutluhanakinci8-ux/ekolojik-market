import { useMemo, useState } from 'react';
import type { Customer } from '../../types/business';
import type { Store } from '../../store/useStore';
import { buildCustomerTimeline } from '../../utils/crm/timeline';
import { computeCustomerRfm } from '../../utils/crm/rfm';
import { getCustomerCrmProfile } from '../../utils/crm/profile';
import { buildCustomerGdprExport } from '../../utils/crm/importExport';
import type { CustomerCrmStatus } from '../../types/crm';
import { SponsorTreePanel } from './SponsorTreePanel';
import { CustomerTagPicker } from './CustomerTagPicker';
import { CrmDocumentAttachments } from './CrmDocumentAttachments';
import { buildSmsContext, phoneToSmsHref, renderSmsTemplate } from '../../utils/crm/smsTemplates';
import { getCustomerBalance } from '../../utils/accountingAnalytics';

interface CustomerCrmSectionProps {
  store: Store;
  customer: Customer;
}

const STATUS_OPTIONS: { value: CustomerCrmStatus; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Pasif' },
  { value: 'cash_only', label: 'Yalnızca nakit/kart' },
  { value: 'blacklist', label: 'Kara liste' },
  { value: 'archived', label: 'Arşiv' },
];

export function CustomerCrmSection({ store, customer }: CustomerCrmSectionProps) {
  const crm = getCustomerCrmProfile(customer, store.crmSettings);
  const [note, setNote] = useState('');
  const [commSummary, setCommSummary] = useState('');
  const [smsTemplateId, setSmsTemplateId] = useState('');
  const [smsStatus, setSmsStatus] = useState<string | null>(null);

  const ledgerBalance = useMemo(() => {
    const entries = store.customerLedger.filter((e) => e.customerId === customer.id);
    return getCustomerBalance(entries);
  }, [customer.id, store.customerLedger]);

  const timeline = useMemo(
    () => buildCustomerTimeline(
      customer.id,
      store.sales,
      store.saleReturns,
      store.customers,
      store.customerLedger,
      store.crmData.manualActivities,
    ),
    [customer.id, store.sales, store.saleReturns, store.customers, store.customerLedger, store.crmData.manualActivities],
  );

  const rfm = useMemo(
    () => computeCustomerRfm(customer.id, store.sales, store.saleReturns, store.customers),
    [customer.id, store.sales, store.saleReturns, store.customers],
  );

  const exportGdpr = () => {
    const json = buildCustomerGdprExport(customer, store.crmSettings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `musteri-${customer.id}-kvkk.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="customer-crm-section">
      <div className="customer-crm-kpis">
        <div className="customer-detail-kpi">
          <span>Sadakat puanı</span>
          <strong>{crm.loyaltyPoints}</strong>
          <em>{crm.loyaltyTier}</em>
        </div>
        <div className="customer-detail-kpi">
          <span>RFM</span>
          <strong>{rfm.segmentLabel}</strong>
          <em>{rfm.frequency} alış · {rfm.recencyDays} gün</em>
        </div>
        <div className="customer-detail-kpi">
          <span>Kredi limiti</span>
          <strong>{crm.creditLimit != null ? `${crm.creditLimit} ₺` : '—'}</strong>
        </div>
      </div>

      <CustomerTagPicker store={store} customerId={customer.id} />

      <div className="settings-form-grid customer-crm-form">
        <label className="settings-field">
          <span>CRM durumu</span>
          <select
            value={crm.status}
            onChange={(e) => store.updateCustomerCrm(customer.id, { status: e.target.value as CustomerCrmStatus })}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Kredi limiti (₺)</span>
          <input
            type="number"
            min="0"
            value={crm.creditLimit ?? ''}
            onChange={(e) => store.updateCustomerCrm(customer.id, {
              creditLimit: e.target.value ? parseFloat(e.target.value) : undefined,
            })}
          />
        </label>
        <label className="settings-field">
          <span>Veresiye vadesi (gün)</span>
          <input
            type="number"
            min="1"
            value={crm.defaultDueDays ?? store.crmSettings.defaultDueDays}
            onChange={(e) => store.updateCustomerCrm(customer.id, { defaultDueDays: parseInt(e.target.value, 10) })}
          />
        </label>
        <label className="settings-field settings-field--full">
          <span>Pazarlama izni</span>
          <div className="crm-consent-row">
            <label>
              <input
                type="checkbox"
                checked={crm.marketingConsent.email}
                onChange={(e) => store.updateCustomerCrm(customer.id, {
                  marketingConsent: { ...crm.marketingConsent, email: e.target.checked, consentedAt: new Date().toISOString() },
                })}
              />
              E-posta
            </label>
            <label>
              <input
                type="checkbox"
                checked={crm.marketingConsent.sms}
                onChange={(e) => store.updateCustomerCrm(customer.id, {
                  marketingConsent: { ...crm.marketingConsent, sms: e.target.checked, consentedAt: new Date().toISOString() },
                })}
              />
              SMS
            </label>
          </div>
        </label>
      </div>

      <div className="crm-sms-form">
        <select value={smsTemplateId} onChange={(e) => setSmsTemplateId(e.target.value)}>
          <option value="">SMS şablonu seç</option>
          {store.crmData.smsTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={!smsTemplateId}
          onClick={() => {
            const template = store.crmData.smsTemplates.find((t) => t.id === smsTemplateId);
            if (!template) return;
            const text = renderSmsTemplate(
              template.body,
              buildSmsContext(customer, store.settings.businessName, ledgerBalance, crm.loyaltyPoints),
            );
            if (customer.phone) {
              window.location.href = phoneToSmsHref(customer.phone, text);
              store.addCrmCommunication(customer.id, 'sms', `SMS: ${template.name}`);
              setSmsStatus('SMS uygulaması açıldı.');
            } else {
              void navigator.clipboard.writeText(text);
              setSmsStatus('Telefon yok — metin panoya kopyalandı.');
            }
          }}
        >
          SMS gönder
        </button>
        {smsStatus && <span className="crm-sms-status">{smsStatus}</span>}
      </div>

      {(customer.greenleafNumber || customer.sponsorGreenleafNumber) && (
        <div className="customer-crm-sponsor-tree">
          <h3>Sponsor ağı</h3>
          <SponsorTreePanel customers={store.customers} rootCustomer={customer} maxDepth={4} />
        </div>
      )}

      <div className="crm-comm-form">
        <input placeholder="İletişim notu (arama, WhatsApp…)" value={commSummary} onChange={(e) => setCommSummary(e.target.value)} />
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => {
            if (!commSummary.trim()) return;
            store.addCrmCommunication(customer.id, 'phone', commSummary.trim());
            setCommSummary('');
          }}
        >
          Kaydet
        </button>
      </div>

      <CrmDocumentAttachments store={store} customer={customer} />

      <div className="crm-timeline">
        <h3>Zaman çizelgesi</h3>
        <ul>
          {timeline.slice(0, 12).map((item) => (
            <li key={item.id}>
              <time>{new Date(item.at).toLocaleString('tr-TR')}</time>
              <strong>{item.title}</strong>
              {item.detail && <span>{item.detail}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="crm-note-form">
        <input placeholder="Manuel not" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            if (!note.trim()) return;
            store.addCrmManualActivity(customer.id, note.trim());
            setNote('');
          }}
        >
          Not ekle
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={exportGdpr}>KVKK export</button>
        <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => store.anonymizeCustomer(customer.id)}>
          Anonimleştir
        </button>
      </div>
    </div>
  );
}
