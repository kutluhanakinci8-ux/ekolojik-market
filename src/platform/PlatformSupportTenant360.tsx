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

type Props = {
  tenantId: string | null;
  onMessage?: (msg: string) => void;
};

export function PlatformSupportTenant360({ tenantId, onMessage }: Props) {
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
      <aside className="platform-panel platform-panel--premium platform-support-360">
        <h3>Kiracı 360</h3>
        <p className="platform-support-hint">Talep veya kuyruk satırından kiracı seçildiğinde özet burada görünür.</p>
      </aside>
    );
  }

  if (loading && !data) {
    return (
      <aside className="platform-panel platform-support-360" aria-busy="true">
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
      </aside>
    );
  }

  return (
    <aside className="platform-panel platform-support-360">
      <div className="platform-panel-head">
        <h3>{data.businessName}</h3>
        {data.demo ? <span className="platform-support-badge platform-support-badge--info">Demo</span> : null}
      </div>
      <p className="platform-table-muted">{data.tenantId}</p>
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
          <p>Cari: {formatTry(data.accounting.receivablesTotalTry)}</p>
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
            <p className="platform-table-muted">
              Başarısız giriş (30g): {data.security.loginFailed30d}
            </p>
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
        <button type="button" className="btn btn-text" onClick={() => void load()}>
          Yenile
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={probeBusy} onClick={() => void runInfraProbe()}>
          {probeBusy ? 'Probe…' : 'SMTP/IMAP probe'}
        </button>
      </div>
      {probeSummary ? <p className="platform-support-hint">{probeSummary}</p> : null}

      <label className="platform-support-reply-label">
        Komut paleti
        <input
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
      <button type="button" className="btn btn-secondary" onClick={() => void runCommand()} disabled={!commandLine.trim()}>
        Çalıştır
      </button>
      {commandHelp.length ? (
        <ul className="platform-support-360-command-help">
          {commandHelp.map((c) => (
            <li key={c.id}>
              <button type="button" className="platform-support-inline-link" onClick={() => setCommandLine(`/${c.id}`)}>
                {c.label}
              </button>
              <span className="platform-table-muted"> — {c.example}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="platform-support-hint platform-support-360-hints">
          Örnek: <code>askıya</code>, <code>/unsuspend</code>, <code>/requeue_outbox</code>
        </p>
      )}
    </aside>
  );
}
