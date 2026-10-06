import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import { buildCustomerCsv } from '../../utils/crm/importExport';
import { filterCustomersBySegment } from '../../utils/crm/segments';
import type { CrmCampaign, CrmCoupon, CrmSavedSegment } from '../../types/crm';
import { SmsTemplatesPanel } from './SmsTemplatesPanel';
import { SponsorTreeExplorer } from './SponsorTreePanel';
import { SegmentRuleEditor } from './SegmentRuleEditor';
import { AutomationOutreachPanel } from './AutomationOutreachPanel';

interface CrmCenterPanelProps {
  store: Store;
}

type CrmTab = 'leads' | 'tasks' | 'campaigns' | 'segments' | 'automation' | 'sms' | 'sponsor' | 'import' | 'merge';

export function CrmCenterPanel({ store }: CrmCenterPanelProps) {
  const [tab, setTab] = useState<CrmTab>('leads');
  const [message, setMessage] = useState<string | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCustomerId, setTaskCustomerId] = useState('');
  const [mergePrimary, setMergePrimary] = useState('');
  const [mergeSecondary, setMergeSecondary] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const openTasks = useMemo(
    () => store.crmData.tasks.filter((t) => t.status === 'open'),
    [store.crmData.tasks],
  );

  const exportCsv = () => {
    const csv = buildCustomerCsv(store.customers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `musteriler-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Müşteri listesi indirildi.');
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = store.importCustomersFromCsv(text);
    setMessage(`${result.imported} müşteri içe aktarıldı.${result.errors.length ? ` Uyarı: ${result.errors.length} satır.` : ''}`);
  };

  const addCampaign = () => {
    if (!campaignName.trim()) return;
    const now = new Date();
    const ends = new Date(now);
    ends.setMonth(ends.getMonth() + 1);
    const campaign: CrmCampaign = {
      id: `CMP-${Date.now()}`,
      name: campaignName.trim(),
      active: true,
      startsAt: now.toISOString(),
      endsAt: ends.toISOString(),
      tagIds: [],
      discountType: 'percent',
      discountValue: 5,
      createdAt: now.toISOString(),
    };
    store.updateCrmData({ campaigns: [campaign, ...store.crmData.campaigns] });
    setCampaignName('');
    setMessage('Kampanya oluşturuldu.');
  };

  const addCoupon = () => {
    if (!couponCode.trim()) return;
    const coupon: CrmCoupon = {
      id: `CPN-${Date.now()}`,
      code: couponCode.trim().toUpperCase(),
      active: true,
      maxUses: 100,
      usedCount: 0,
      discountType: 'percent',
      discountValue: 10,
      createdAt: new Date().toISOString(),
    };
    store.updateCrmData({ coupons: [coupon, ...store.crmData.coupons] });
    setCouponCode('');
    setMessage('Kupon eklendi.');
  };

  const addSegment = () => {
    if (!segmentName.trim()) return;
    const segment: CrmSavedSegment = {
      id: `SEG-${Date.now()}`,
      name: segmentName.trim(),
      rules: [{ id: 'r1', field: 'days_since_purchase', operator: 'gt', value: '90' }],
      createdAt: new Date().toISOString(),
    };
    store.updateCrmData({ segments: [segment, ...store.crmData.segments] });
    setSegmentName('');
    setMessage('Segment kaydedildi (örnek kural: 90+ gün alışveriş yok).');
  };

  return (
    <section className="settings-panel crm-center-panel">
      <div className="settings-panel-head">
        <div>
          <h2>CRM Merkezi</h2>
          <p>Lead, görev, kampanya, segment ve veri araçları</p>
        </div>
      </div>

      {message && <p className="settings-flash">{message}</p>}

      <nav className="crm-center-tabs" aria-label="CRM alt sekmeler">
        {(['leads', 'tasks', 'campaigns', 'segments', 'automation', 'sms', 'sponsor', 'import', 'merge'] as CrmTab[]).map((id) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {id === 'leads' && 'Lead'}
            {id === 'tasks' && 'Görevler'}
            {id === 'campaigns' && 'Kampanya'}
            {id === 'segments' && 'Segment'}
            {id === 'automation' && 'Otomasyon'}
            {id === 'sms' && 'SMS'}
            {id === 'sponsor' && 'Sponsor ağacı'}
            {id === 'import' && 'İçe/Dışa'}
            {id === 'merge' && 'Birleştir'}
          </button>
        ))}
      </nav>

      {tab === 'leads' && (
        <div className="crm-center-block">
          <div className="crm-center-form-row">
            <input placeholder="Lead adı" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
            <input placeholder="Telefon" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => {
              if (!leadName.trim()) return;
              store.addCrmLead({ name: leadName, phone: leadPhone });
              setLeadName('');
              setLeadPhone('');
              setMessage('Lead kaydedildi.');
            }}>
              Ekle
            </button>
          </div>
          <ul className="crm-center-list">
            {store.crmData.leads.map((lead) => (
              <li key={lead.id}>
                <strong>{lead.name}</strong>
                <span>{lead.stage}</span>
                {lead.phone && <em>{lead.phone}</em>}
                {lead.stage !== 'converted' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      store.convertCrmLead(lead.id, {
                        type: 'individual',
                        name: lead.name,
                        taxNumber: '00000000000',
                        address: '',
                        city: '',
                        district: '',
                        country: 'Türkiye',
                        phone: lead.phone,
                        email: lead.email,
                        registeredFrom: 'admin',
                      });
                      setMessage('Lead müşteriye dönüştürüldü.');
                    }}
                  >
                    Müşteri yap
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="crm-center-block">
          <div className="crm-center-form-row">
            <input placeholder="Görev başlığı" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <select value={taskCustomerId} onChange={(e) => setTaskCustomerId(e.target.value)}>
              <option value="">Müşteri (opsiyonel)</option>
              {store.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => {
              store.addCrmTask({ title: taskTitle, customerId: taskCustomerId || undefined });
              setTaskTitle('');
              setMessage('Görev eklendi.');
            }}>
              Ekle
            </button>
          </div>
          <ul className="crm-center-list">
            {openTasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => store.completeCrmTask(task.id)}>
                  Tamamla
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="crm-center-block">
          <div className="crm-center-form-row">
            <input placeholder="Kampanya adı" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={addCampaign}>Kampanya</button>
            <input placeholder="Kupon kodu" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={addCoupon}>Kupon</button>
          </div>
          <p className="module-hint">Aktif kampanya: {store.crmData.campaigns.filter((c) => c.active).length} · Kupon: {store.crmData.coupons.length}</p>
        </div>
      )}

      {tab === 'segments' && (
        <div className="crm-center-block">
          <div className="crm-center-form-row">
            <input placeholder="Segment adı" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={addSegment}>Kaydet</button>
          </div>
          <ul className="crm-center-list">
            {store.crmData.segments.map((seg) => {
              const count = filterCustomersBySegment(
                seg,
                store.customers,
                store.sales,
                store.saleReturns,
                store.customerLedger,
                store.crmSettings,
              ).length;
              return (
                <li key={seg.id}>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingSegmentId(seg.id)}>
                    Düzenle
                  </button>
                  <strong>{seg.name}</strong>
                  <span>{count} müşteri · {seg.rules.length} kural</span>
                </li>
              );
            })}
          </ul>
          {editingSegmentId && (() => {
            const seg = store.crmData.segments.find((s) => s.id === editingSegmentId);
            if (!seg) return null;
            return (
              <div className="segment-editor-panel">
                <h4>{seg.name} — kurallar</h4>
                <SegmentRuleEditor
                  rules={seg.rules}
                  onChange={(rules) => store.saveCrmSegment({ ...seg, rules })}
                />
              </div>
            );
          })()}
        </div>
      )}

      {tab === 'automation' && (
        <AutomationOutreachPanel store={store} />
      )}

      {tab === 'sms' && (
        <SmsTemplatesPanel store={store} />
      )}

      {tab === 'sponsor' && (
        <SponsorTreeExplorer customers={store.customers} />
      )}

      {tab === 'import' && (
        <div className="crm-center-block">
          <button type="button" className="btn btn-outline" onClick={exportCsv}>CSV İndir</button>
          <label className="btn btn-primary crm-import-label">
            CSV Yükle
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => handleImport(e.target.files?.[0])} />
          </label>
          <p className="module-hint">Şablon sütunları: name;type;taxNumber;phone;email;...</p>
        </div>
      )}

      {tab === 'merge' && (
        <div className="crm-center-block">
          <select value={mergePrimary} onChange={(e) => setMergePrimary(e.target.value)}>
            <option value="">Birincil müşteri</option>
            {store.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={mergeSecondary} onChange={(e) => setMergeSecondary(e.target.value)}>
            <option value="">Birleştirilecek</option>
            {store.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-danger-soft"
            onClick={() => {
              const err = store.mergeCrmCustomers(mergePrimary, mergeSecondary);
              setMessage(err ?? 'Müşteriler birleştirildi.');
            }}
          >
            Birleştir
          </button>
        </div>
      )}
    </section>
  );
}
