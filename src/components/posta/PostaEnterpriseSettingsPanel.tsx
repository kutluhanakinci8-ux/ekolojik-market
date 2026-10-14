import { useCallback, useEffect, useState } from 'react';
import {
  fetchPostaComplianceArchive,
  fetchPostaDelegates,
  fetchPostaEnterpriseCapabilities,
  fetchPostaMarketingCampaigns,
  runPostaMarketingCampaign,
  savePostaDelegates,
  setPostaLegalHold,
  upsertPostaMarketingCampaign,
  type PostaDelegateRow,
  type PostaMarketingCampaign,
} from '../../services/postaEnterpriseService';

type Props = {
  onFlash?: (msg: string) => void;
};

const emptyDelegate = (): PostaDelegateRow => ({
  userId: '',
  displayName: '',
  role: 'read',
  sendAs: [],
});

export function PostaEnterpriseSettingsPanel({ onFlash }: Props) {
  const flash = onFlash ?? (() => {});
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof fetchPostaEnterpriseCapabilities>> | null>(
    null,
  );
  const [delegates, setDelegates] = useState<PostaDelegateRow[]>([]);
  const [sendAsAliases, setSendAsAliases] = useState('');
  const [campaigns, setCampaigns] = useState<PostaMarketingCampaign[]>([]);
  const [campaignDraft, setCampaignDraft] = useState({
    name: 'Kampanya',
    subject: '',
    bodyText: '',
    segmentTag: '',
    variantBSubject: '',
    variantBBody: '',
  });
  const [holdIds, setHoldIds] = useState('');
  const [archivePreview, setArchivePreview] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cap, del, camp] = await Promise.all([
        fetchPostaEnterpriseCapabilities(),
        fetchPostaDelegates(),
        fetchPostaMarketingCampaigns(),
      ]);
      if (cap.ok) setCapabilities(cap);
      if (del.ok) {
        setDelegates(del.delegates?.length ? del.delegates : [emptyDelegate()]);
        setSendAsAliases((del.sendAsAliases ?? []).join('\n'));
      }
      if (camp.ok) setCampaigns(camp.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDelegates = async () => {
    setLoading(true);
    const payload = {
      delegates: delegates
        .filter((d) => d.userId.trim())
        .map((d) => ({
          ...d,
          sendAs: d.sendAs?.length ? d.sendAs : [],
        })),
      sendAsAliases: sendAsAliases
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const r = await savePostaDelegates(payload);
    setLoading(false);
    flash(r.ok ? 'Delegasyon kaydedildi.' : r.error ?? 'Kayıt başarısız');
    await reload();
  };

  const saveCampaign = async () => {
    if (!campaignDraft.subject.trim() || !campaignDraft.bodyText.trim()) {
      flash('Kampanya konu ve metin gerekli.');
      return;
    }
    setLoading(true);
    const r = await upsertPostaMarketingCampaign({
      name: campaignDraft.name,
      subject: campaignDraft.subject,
      bodyText: campaignDraft.bodyText,
      segmentTag: campaignDraft.segmentTag.trim() || null,
      status: 'draft',
      variantB:
        campaignDraft.variantBSubject.trim()
          ? { subject: campaignDraft.variantBSubject, bodyText: campaignDraft.variantBBody || campaignDraft.bodyText }
          : null,
    });
    setLoading(false);
    if (!r.ok) {
      flash(r.error ?? 'Kampanya kaydedilemedi');
      return;
    }
    flash('Kampanya kaydedildi.');
    await reload();
  };

  const runCampaign = async (id: string) => {
    setLoading(true);
    const r = await runPostaMarketingCampaign(id);
    setLoading(false);
    flash(r.ok ? `${r.enqueued ?? 0} alıcı kuyruğa alındı.` : r.error ?? 'Çalıştırma başarısız');
    await reload();
  };

  const applyLegalHold = async (hold: boolean) => {
    const ids = holdIds
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      flash('Mesaj ID girin.');
      return;
    }
    setLoading(true);
    const r = await setPostaLegalHold(ids, hold);
    setLoading(false);
    flash(r.ok ? `Legal hold: ${r.count ?? ids.length} kayıt` : r.error ?? 'İşlem başarısız');
  };

  const exportArchive = async () => {
    setLoading(true);
    const r = await fetchPostaComplianceArchive(500);
    setLoading(false);
    if (!r.ok) {
      flash(r.error ?? 'Arşiv alınamadı');
      return;
    }
    const json = JSON.stringify(r, null, 2);
    setArchivePreview(`${r.messageCount ?? 0} mesaj · legal hold: ${r.legalHoldCount ?? 0}`);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posta-compliance-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('eDiscovery-lite arşiv indirildi.');
  };

  return (
    <section className="settings-subpanel posta-enterprise-panel">
      <div className="settings-panel-head">
        <div>
          <h3>Kurumsal posta (M365 katmanı)</h3>
          <p>
            Delegasyon, kampanya, uyumluluk — API yüzeyinin operatör paneli.
            {capabilities?.ok ? ` Parite: ${capabilities.overallPercent}%` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline" disabled={loading} onClick={() => void reload()}>
          Yenile
        </button>
      </div>

      {capabilities?.scores && (
        <div className="settings-stat-grid" style={{ marginBottom: 12 }}>
          {Object.entries(capabilities.scores).map(([key, val]) => (
            <article key={key} className="settings-stat-card">
              <span className="settings-stat-label">{key}</span>
              <strong>{val}%</strong>
            </article>
          ))}
        </div>
      )}

      <h4>Paylaşımlı kutu / delegasyon</h4>
      <p className="settings-hint">
        Delegate kullanıcılar Posta sekmesi olmadan (yalnızca delegate listesinde) posta API erişebilir. Send-as alias
        satır başına.
      </p>
      <ul className="posta-enterprise-delegate-list">
        {delegates.map((row, index) => (
          <li key={index} className="settings-form-grid">
            <label className="settings-field">
              <span>Kullanıcı ID / ad</span>
              <input
                value={row.userId}
                onChange={(e) =>
                  setDelegates((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, userId: e.target.value } : r)),
                  )
                }
              />
            </label>
            <label className="settings-field">
              <span>Görünen ad</span>
              <input
                value={row.displayName}
                onChange={(e) =>
                  setDelegates((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, displayName: e.target.value } : r)),
                  )
                }
              />
            </label>
            <label className="settings-field">
              <span>Rol</span>
              <select
                value={row.role}
                onChange={(e) =>
                  setDelegates((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, role: e.target.value as PostaDelegateRow['role'] } : r,
                    ),
                  )
                }
              >
                <option value="read">Okuma</option>
                <option value="send">Gönderme</option>
                <option value="full">Tam</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-text"
              onClick={() => setDelegates((prev) => prev.filter((_, i) => i !== index))}
            >
              Sil
            </button>
          </li>
        ))}
      </ul>
      <div className="settings-panel-actions">
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setDelegates((p) => [...p, emptyDelegate()])}>
          Delegate ekle
        </button>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void saveDelegates()}>
          Delegasyonu kaydet
        </button>
      </div>
      <label className="settings-field settings-field--full">
        <span>Send-as alias (satır başına)</span>
        <textarea rows={2} value={sendAsAliases} onChange={(e) => setSendAsAliases(e.target.value)} />
      </label>

      <h4 style={{ marginTop: 24 }}>Pazarlama kampanyaları (lite)</h4>
      <div className="settings-form-grid">
        <label className="settings-field">
          <span>Ad</span>
          <input
            value={campaignDraft.name}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className="settings-field">
          <span>Segment etiketi</span>
          <input
            value={campaignDraft.segmentTag}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, segmentTag: e.target.value }))}
            placeholder="opsiyonel"
          />
        </label>
        <label className="settings-field settings-field--full">
          <span>Konu</span>
          <input
            value={campaignDraft.subject}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, subject: e.target.value }))}
          />
        </label>
        <label className="settings-field settings-field--full">
          <span>Metin</span>
          <textarea
            rows={3}
            value={campaignDraft.bodyText}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, bodyText: e.target.value }))}
          />
        </label>
        <label className="settings-field">
          <span>A/B konu (B)</span>
          <input
            value={campaignDraft.variantBSubject}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, variantBSubject: e.target.value }))}
          />
        </label>
        <label className="settings-field">
          <span>A/B metin (B)</span>
          <input
            value={campaignDraft.variantBBody}
            onChange={(e) => setCampaignDraft((d) => ({ ...d, variantBBody: e.target.value }))}
          />
        </label>
      </div>
      <div className="settings-panel-actions">
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void saveCampaign()}>
          Kampanya kaydet
        </button>
      </div>
      {campaigns.length > 0 && (
        <table className="settings-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void runCampaign(c.id)}>
                    Outbox’a gönder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 style={{ marginTop: 24 }}>Uyumluluk (eDiscovery-lite)</h4>
      <p className="settings-hint">
        Legal hold için gelen kutusu mesaj ID’leri. DLP: outbox gönderiminde{' '}
        <code>EKOLOJIK_POSTA_DLP_PATTERNS</code>.
      </p>
      <label className="settings-field settings-field--full">
        <span>Mesaj ID listesi</span>
        <textarea rows={2} value={holdIds} onChange={(e) => setHoldIds(e.target.value)} placeholder="id1, id2" />
      </label>
      <div className="settings-panel-actions">
        <button type="button" className="btn btn-sm btn-outline" disabled={loading} onClick={() => void applyLegalHold(true)}>
          Legal hold uygula
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={loading} onClick={() => void applyLegalHold(false)}>
          Hold kaldır
        </button>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void exportArchive()}>
          Arşiv JSON indir
        </button>
      </div>
      {archivePreview && <p className="settings-hint">{archivePreview}</p>}
    </section>
  );
}
