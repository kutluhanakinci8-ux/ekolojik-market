import { useCallback, useEffect, useState } from 'react';
import { fetchPlatformSupportSlaLive, type PlatformSupportSlaLivePayload } from '../services/platformApi';
import { RingProgress } from './platformUserUi';

const SEV_LABELS: Record<string, string> = {
  critical: 'Kritik',
  warning: 'Uyarı',
  info: 'Normal',
};

type Props = {
  windowDays: number;
  onOpenCase?: (caseId: string) => void;
  onFocusQueueTenant?: (tenantId: string) => void;
  onSendSlaApology?: (caseId: string) => void;
  slaApologyBusyId?: string | null;
  onSendSlaApologyBatch?: (caseIds: string[]) => void;
  slaApologyBatchBusy?: boolean;
};

function formatOverdue(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk`;
  return `${(ms / 3600_000).toFixed(1)} sa`;
}

export function PlatformSupportSlaLive({
  windowDays,
  onOpenCase,
  onFocusQueueTenant,
  onSendSlaApology,
  slaApologyBusyId,
  onSendSlaApologyBatch,
  slaApologyBatchBusy,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlatformSupportSlaLivePayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPlatformSupportSlaLive(windowDays);
    setLoading(false);
    if (res.ok && res.data) setData(res.data);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="platform-support-hint">SLA paneli yükleniyor…</p>;
  }
  if (!data) {
    return <p className="platform-support-hint">SLA verisi alınamadı.</p>;
  }

  const pct = data.compliancePercent ?? 0;
  const variant = pct >= 85 ? 'brand' : pct >= 60 ? 'warn' : 'muted';
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.met + d.breached));

  return (
    <div className="platform-support-sla-live">
      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi platform-support-kpi-ring">
          <RingProgress pct={pct} label="SLA uyumu" variant={variant} />
          <span className="platform-users-kpi-sub">{data.windowDays} gün penceresi</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Kuyruk</span>
          <strong className="platform-users-kpi-value">{data.totals.queueSize}</strong>
          <span className="platform-users-kpi-sub">{data.totals.pendingFirstResponse} ilk yanıt</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Case SLA aşımı</span>
          <strong className="platform-users-kpi-value">{data.caseOverdue}</strong>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Önem dağılımı</span>
          <strong className="platform-users-kpi-value">{data.queueBySeverity.critical}</strong>
          <span className="platform-users-kpi-sub">
            kritik · {data.queueBySeverity.warning} uyarı · {data.queueBySeverity.info} normal
          </span>
        </article>
      </div>

      <section className="platform-panel">
        <h3>Günlük ilk yanıt (prod)</h3>
        <div className="platform-support-sla-bars" role="img" aria-label="Günlük SLA çubuk grafiği">
          {data.daily.map((d) => {
            const total = d.met + d.breached;
            const hMet = total ? Math.round((d.met / maxDaily) * 100) : 0;
            const hBreached = total ? Math.round((d.breached / maxDaily) * 100) : 0;
            return (
              <div key={d.dateKey} className="platform-support-sla-bar-col" title={`${d.dateKey}: ${d.met} uyum, ${d.breached} ihlal`}>
                <div className="platform-support-sla-bar-stack">
                  {hBreached > 0 ? <span className="platform-support-sla-bar platform-support-sla-bar--breach" style={{ height: `${hBreached}%` }} /> : null}
                  {hMet > 0 ? <span className="platform-support-sla-bar platform-support-sla-bar--met" style={{ height: `${hMet}%` }} /> : null}
                </div>
                <span className="platform-support-sla-bar-label">{d.dateKey.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {data.apologyQueue?.count ? (
        <section className="platform-panel">
          <div className="platform-users-panel-head">
            <h3>SLA özür kuyruğu</h3>
            {onSendSlaApologyBatch ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={slaApologyBatchBusy}
                onClick={() =>
                  onSendSlaApologyBatch((data.apologyQueue?.items ?? []).map((i) => i.id))
                }
              >
                {slaApologyBatchBusy ? 'Gönderiliyor…' : `Tümünü gönder (${data.apologyQueue.count})`}
              </button>
            ) : null}
          </div>
          <p className="platform-support-hint">
            E-postası olan, SLA süresi geçmiş ve daha önce özür gönderilmemiş kayıtlar.
          </p>
          <ul className="platform-support-apology-queue">
            {(data.apologyQueue.items ?? []).map((item) => (
              <li key={item.id}>
                <strong>#{item.number}</strong> {item.subject}
                <span className="platform-muted"> — {item.requesterEmail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.overdueCases?.length ? (
        <section className="platform-panel">
          <h3>SLA süresi geçen kayıtlar</h3>
          <table className="platform-table platform-table--scroll">
            <thead>
              <tr>
                <th>#</th>
                <th>Konu</th>
                <th>Kiracı</th>
                <th>Gecikme</th>
                {onSendSlaApology ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {data.overdueCases.map((c) => (
                <tr key={c.id}>
                  <td>
                    {onOpenCase ? (
                      <button type="button" className="btn btn-text" onClick={() => onOpenCase(c.id)}>
                        {c.number}
                      </button>
                    ) : (
                      c.number
                    )}
                  </td>
                  <td>{c.subject}</td>
                  <td>{c.businessName ?? c.tenantId ?? '—'}</td>
                  <td>{formatOverdue(c.overdueMs)}</td>
                  {onSendSlaApology ? (
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={slaApologyBusyId === c.id}
                        onClick={() => onSendSlaApology(c.id)}
                      >
                        {slaApologyBusyId === c.id ? '…' : 'Özür maili'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="platform-panel">
        <h3>Öncelikli kuyruk (canlı)</h3>
        <table className="platform-table platform-table--scroll">
          <thead>
            <tr>
              <th>Önem</th>
              <th>Kiracı</th>
              <th>Konu</th>
              <th>Bekleme</th>
            </tr>
          </thead>
          <tbody>
            {data.topQueue.length === 0 ? (
              <tr>
                <td colSpan={4}>Kuyruk boş</td>
              </tr>
            ) : (
              data.topQueue.map((q) => (
                <tr key={q.id}>
                  <td>{SEV_LABELS[q.severity] ?? q.severity}</td>
                  <td>
                    {q.tenantId && onFocusQueueTenant ? (
                      <button type="button" className="btn btn-text" onClick={() => onFocusQueueTenant(q.tenantId!)}>
                        {q.businessName}
                      </button>
                    ) : (
                      q.businessName
                    )}
                  </td>
                  <td>{q.subject}</td>
                  <td>{Math.round((q.waitMs ?? 0) / 60_000)} dk</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <button type="button" className="btn btn-text" onClick={() => void load()}>
          Yenile
        </button>
      </section>
    </div>
  );
}
