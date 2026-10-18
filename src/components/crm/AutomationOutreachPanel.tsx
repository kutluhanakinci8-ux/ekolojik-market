import { useState } from 'react';
import type { Store } from '../../store/useStore';
import type { CrmAutomationFlow, CrmAutomationTrigger } from '../../types/crm';
import { SmsTemplatesPanel } from './SmsTemplatesPanel';

interface AutomationOutreachPanelProps {
  store: Store;
}

const TRIGGERS: Array<{ value: CrmAutomationTrigger; label: string }> = [
  { value: 'days_since_purchase', label: 'X gün alışveriş yok' },
  { value: 'birthday_today', label: 'Doğum günü bugün' },
  { value: 'overdue_balance', label: 'Vadesi geçen bakiye' },
  { value: 'segment_match', label: 'Segmente uyan' },
];

export function AutomationOutreachPanel({ store }: AutomationOutreachPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('');
  const [emailName, setEmailName] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const pending = store.crmData.outreachQueue.filter((q) => q.status === 'pending');

  const addFlow = () => {
    if (!flowName.trim()) return;
    const flow: CrmAutomationFlow = {
      id: `FLOW-${Date.now()}`,
      name: flowName.trim(),
      active: true,
      trigger: 'days_since_purchase',
      triggerValue: '30',
      channel: 'email',
      emailTemplateId: store.crmData.emailTemplates[0]?.id,
      smsTemplateId: store.crmData.smsTemplates[0]?.id,
      createdAt: new Date().toISOString(),
    };
    store.updateCrmData({ automationFlows: [flow, ...store.crmData.automationFlows] });
    setFlowName('');
    setMessage('Kampanya akışı eklendi — kuralları düzenleyin.');
  };

  const saveEmailTemplate = () => {
    const id = store.saveCrmEmailTemplate(null, emailName, emailSubject, emailBody);
    if (id) {
      setEmailName('');
      setEmailSubject('');
      setEmailBody('');
      setMessage('E-posta şablonu kaydedildi.');
    }
  };

  return (
    <div className="automation-outreach-panel">
      {message && <p className="settings-flash">{message}</p>}

      <section className="crm-center-block">
        <h3>Otomasyon</h3>
        <p className="module-hint">
          Günlük tetikleme Panel açılışında çalışır. E-posta için sunucuda{' '}
          <code>CRM_RESEND_API_KEY</code> ve <code>CRM_EMAIL_FROM</code> tanımlayın.
        </p>
        <div className="crm-center-form-row">
          <button type="button" className="btn btn-primary" onClick={() => {
            const n = store.runCrmDailyAutomation();
            setMessage(n > 0 ? `${n} mesaj kuyruğa eklendi.` : 'Bugün için otomasyon zaten çalıştı veya hedef yok.');
          }}>
            Otomasyonu çalıştır
          </button>
          <button type="button" className="btn btn-outline" onClick={async () => {
            const result = await store.processCrmOutreachQueue();
            setMessage(`${result.sent} gönderildi, ${result.failed} hata, ${result.skipped} atlandı.`);
          }}>
            Kuyruğu işle ({pending.length} bekleyen)
          </button>
        </div>

        <div className="crm-center-form-row">
          <input placeholder="Yeni akış adı" value={flowName} onChange={(e) => setFlowName(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={addFlow}>Akış ekle</button>
        </div>

        <ul className="crm-center-list">
          {store.crmData.automationFlows.map((flow) => (
            <li key={flow.id}>
              <strong>{flow.name}</strong>
              <select
                value={flow.trigger}
                onChange={(e) => store.saveCrmAutomationFlow(flow.id, { trigger: e.target.value as CrmAutomationTrigger })}
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                value={flow.triggerValue}
                onChange={(e) => store.saveCrmAutomationFlow(flow.id, { triggerValue: e.target.value })}
                placeholder="Değer"
              />
              <select
                value={flow.channel}
                onChange={(e) => store.saveCrmAutomationFlow(flow.id, { channel: e.target.value as 'sms' | 'email' })}
              >
                <option value="email">E-posta</option>
                <option value="sms">SMS</option>
              </select>
              <select
                value={flow.segmentId ?? ''}
                onChange={(e) => store.saveCrmAutomationFlow(flow.id, { segmentId: e.target.value || undefined })}
              >
                <option value="">Segment (opsiyonel)</option>
                {store.crmData.segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={flow.active}
                  onChange={(e) => store.saveCrmAutomationFlow(flow.id, { active: e.target.checked })}
                />
                Aktif
              </label>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => store.removeCrmAutomationFlow(flow.id)}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="crm-center-block">
        <h3>E-posta şablonları</h3>
        <div className="crm-center-form-row">
          <input placeholder="Ad" value={emailName} onChange={(e) => setEmailName(e.target.value)} />
          <input placeholder="Konu" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          <textarea placeholder="Gövde" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={2} />
          <button type="button" className="btn btn-primary" onClick={saveEmailTemplate}>Kaydet</button>
        </div>
        <ul className="crm-center-list">
          {store.crmData.emailTemplates.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong>
              <span>{t.subject}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="crm-center-block">
        <h3>SMS şablonları</h3>
        <SmsTemplatesPanel store={store} />
      </section>

      <section className="crm-center-block">
        <h3>Gönderim kuyruğu</h3>
        <ul className="crm-center-list crm-outreach-queue">
          {store.crmData.outreachQueue.slice(0, 20).map((item) => {
            const customer = store.customers.find((c) => c.id === item.customerId);
            return (
              <li key={item.id}>
                <strong>{customer?.name ?? item.customerId}</strong>
                <span>{item.channel}</span>
                <span className={`crm-outreach-status crm-outreach-status--${item.status}`}>{item.status}</span>
                <small>{item.body.slice(0, 80)}…</small>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
