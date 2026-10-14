import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPlatformSupportCommands,
  fetchPlatformSupportTenant360,
  postPlatformSupportCommand,
  runPlatformInfrastructureProbe,
  type PlatformSupportCommandHelp,
  type PlatformSupportTenant360Payload,
} from '../services/platformApi';
import { saveTenantId } from '../storage/tenantSession';
import { syncPosApiTokenToCurrentTenant } from '../services/posApiAuth';

function formatTry(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export type PlatformSupportCasePreview = {
  number: number;
  subject: string;
  requesterEmail?: string | null;
  requesterName?: string | null;
  channel: string;
  tenantHint?: string | null;
};

type Props = {
  tenantId: string | null;
  casePreview?: PlatformSupportCasePreview | null;
  onMessage?: (msg: string) => void;
};

export function PlatformSupportTenant360({ tenantId, casePreview, onMessage }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PlatformSupportTenant360Payload | null>(null);
  const [commandLine, setCommandLine] = useState('');
  const [commandHelp, setCommandHelp] = useState<PlatformSupportCommandHelp[]>([]);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeSummary, setProbeSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setData(null);
      return;
    }
    setLoading(true);
    const res = await fetchPlatformSupportTenant360(tenantId);
    setLoading(false);
    if (res.ok && res.data) setData(res.data);
    else setData(null);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetchPlatformSupportCommands();
      if (res.ok && res.commands?.length) setCommandHelp(res.commands);
    })();
  }, []);

  const runInfraProbe = async () => {
    setProbeBusy(true);
    setProbeSummary(null);
    const res = await runPlatformInfrastructureProbe();
    setProbeBusy(false);
    if (!res.ok || !res.probes) {
      onMessage?.(res.error ?? 'Probe başarısız');
      return;
    }
    const smtp = res.probes.smtp?.ok ? 'SMTP OK' : `SMTP: ${res.probes.smtp?.error ?? 'hata'}`;
    const imap = res.probes.imap?.ok
      ? `IMAP OK${res.probes.imap.message ? ` (${res.probes.imap.message})` : ''}`
      : `IMAP: ${res.probes.imap?.error ?? 'hata'}`;
    setProbeSummary(`${smtp} · ${imap}`);
  };

  const openPos = () => {
    if (!tenantId) return;
    saveTenantId(tenantId);
    syncPosApiTokenToCurrentTenant();
    navigate('/app', { replace: true });
  };

  const runCommand = async () => {
    if (!tenantId || !commandLine.trim()) return;
    const res = await postPlatformSupportCommand({ tenantId, line: commandLine.trim() });
    if (!res.ok) {
      const hint = res.hints?.length ? ` (${res.hints.join(', ')})` : '';
      onMessage?.(`${res.error ?? 'Komut başarısız'}${hint}`);
      return;
    }
    onMessage?.('Komut uygulandı');
    setCommandLine('');
    void load();
  };

  if (!tenantId) {
    return (
      <aside className="platform-panel platform-panel--premium platform-support-360 platform-support-360--empty">
        <div className="platform-support-360-empty-head">
          <h3>Kiracı 360</h3>
          <span className="platform-support-360-kicker">Özet panel</span>
        </div>
        {casePreview ? (
          <article className="platform-support-360-card platform-support-360-card--accent">
            <h4>Seçili talep #{casePreview.number}</h4>
            <p className="platform-support-360-case-title">{casePreview.subject}</p>
            <p className="platform-table-muted">
              {casePreview.channel} · {casePreview.requesterEmail ?? casePreview.requesterName ?? '—'}
            </p>
            {casePreview.tenantHint ? (
              <p className="platform-support-hint">
                Önerilen kiracı: <code>{casePreview.tenantHint}</code> — kayıt meta alanından bağlayın veya kaydı
                güncelleyin.
              </p>
            ) : (
              <p className="platform-support-hint">
                Bu kayıtta kiracı atanmamış. Orta panelde <strong>Kiracı ID</strong> girin (ör. <code>main</code>) ve
                kaydedin.
              </p>
            )}
          </article>
        ) : (
          <p className="platform-support-hint">Talep veya kuyruk satırından kiracı seçildiğinde özet burada görünür.</p>
        )}
      </aside>
    );
  }

  if (loading && !data) {
    return (
      <aside className="platform-panel platform-panel--premium platform-support-360" aria-busy="true">
        <h3>Kiracı 360</h3>
        <p className="platform-support-hint">Yükleniyor…</p>
      </aside>
    );
  }

  if (!data) {
    return (
      <aside className="platform-panel platform-panel--premium platform-support-360">
        <h3>Kiracı 360</h3>
        <p className="platform-support-hint">Özet alınamadı.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>Yenile</button>
      </aside>
    );
  }

  return (
    <aside className="platform-panel platform-panel--premium platform-support-360">
      <div className="platform-support-360-empty-head">
        <div>
          <h3>{data.businessName}</h3>
          <p className="platform-table-muted">{data.tenantId}</p>
        </div>
        {data.demo ? <span className="platform-support-badge platform-support-badge--info">Demo</span> : null}
      </div>
      {casePreview ? (
        <p className="platform-support-360-linked-case">
          Talep <strong>#{casePreview.number}</strong> · {casePreview.subject}
        </p>
      ) : null}
      {data.lifecycle ? (
        <p className="platform-support-hint">
          {data.lifecycle.statusLabel}
          {data.lifecycle.suspended ? ' · Askıda' : ''}
          {data.lifecycle.readOnly ? ' · Salt okunur' : ''}
        </p>
      ) : null}

      <div className="platform-support-360-widgets">
        <article className="platform-support-360-card">
          <h4>Muhasebe</h4>
          <p>{formatTry(data.accounting.receivablesTotalTry)}</p>
          <p className="platform-table-muted">
            Gecikmiş: {data.accounting.overduePaymentCount} ({formatTry(data.accounting.overduePaymentAmountTry)})
          </p>
        </article>
        <article className="platform-support-360-card">
          <h4>Stok</h4>
          <p>{data.stock.productCount} ürün · {data.stock.lowStockCount} düşük stok</p>
          {data.stock.lowStockSample.length ? (
            <ul className="platform-support-360-list">
              {data.stock.lowStockSample.map((p) => (
                <li key={p.id}>{p.name} ({p.stock})</li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="platform-support-360-card">
          <h4>Satış (30g)</h4>
          <p>{data.sales.recentSaleCount30d} fiş · {formatTry(data.sales.revenue30dTry)}</p>
        </article>
        {data.security ? (
          <article className="platform-support-360-card">
            <h4>Güvenlik</h4>
            <p>Skor: {data.security.securityScore}</p>
            <p className="platform-table-muted">Başarısız giriş (30g): {data.security.loginFailed30d}</p>
          </article>
        ) : null}
        <article className="platform-support-360-card">
          <h4>Posta / mesaj</h4>
          <p>
            Outbox: {data.comms.outbox.pending} bekleyen, {data.comms.outbox.failed} hata
          </p>
          <p className="platform-table-muted">
            Açık thread: {data.comms.messaging.open ?? 0} · ilk yanıt bekliyor:{' '}
            {data.comms.messaging.pendingFirstResponse ?? 0}
          </p>
        </article>
      </div>

      {data.openCases.length ? (
        <div className="platform-support-360-cases">
          <h4>Açık talepler</h4>
          <ul className="platform-support-360-list">
            {data.openCases.map((c) => (
              <li key={c.id}>#{c.number} {c.subject}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="platform-support-360-actions">
        <button type="button" className="btn btn-primary" onClick={openPos}>
          POS aç
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
          Yenile
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={probeBusy} onClick={() => void runInfraProbe()}>
          {probeBusy ? 'Probe…' : 'SMTP/IMAP'}
        </button>
      </div>
      {probeSummary ? <p className="platform-support-hint">{probeSummary}</p> : null}

      <label className="platform-support-field platform-support-360-command">
        <span className="platform-support-field-label">Komut paleti</span>
        <input
          className="platform-support-control"
          value={commandLine}
          onChange={(e) => setCommandLine(e.target.value)}
          placeholder="/suspend veya requeue_outbox"
          list="platform-support-command-suggestions"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runCommand();
          }}
        />
      </label>
      <datalist id="platform-support-command-suggestions">
        {commandHelp.map((c) => (
          <option key={c.id} value={`/${c.id}`}>{c.label}</option>
        ))}
      </datalist>
      <button type="button" className="btn btn-secondary btn-sm platform-support-360-run" onClick={() => void runCommand()} disabled={!commandLine.trim()}>
        Çalıştır
      </button>
    </aside>
  );
}
