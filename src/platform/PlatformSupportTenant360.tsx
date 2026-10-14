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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('tr-TR');
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Yönetici',
  cashier: 'Kasiyer',
};

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
  const [showOps, setShowOps] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchPlatformSupportTenant360(tenantId);
    setLoading(false);
    if (res.ok && res.data) setData(res.data);
    else setData(null);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
    }
    void load();
  }, [load, tenantId]);

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
          <span className="platform-support-360-kicker">Kimlik & kullanıcılar</span>
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
                Önerilen kiracı: <code>{casePreview.tenantHint}</code> — kayıt meta alanından bağlayın.
              </p>
            ) : (
              <p className="platform-support-hint">
                <strong>Kiracı ID</strong> alanına <code>main</code> yazıp kaydedin.
              </p>
            )}
          </article>
        ) : (
          <p className="platform-support-hint">Talep seçildiğinde mağaza kimliği burada görünür.</p>
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

  const roster = data.userRoster ?? [];
  const logins = data.loginActivity ?? [];
  const summary = data.loginSummary;

  return (
    <aside className="platform-panel platform-panel--premium platform-support-360">
      <div className="platform-support-360-empty-head">
        <div>
          <h3>{data.businessName}</h3>
          <p className="platform-table-muted">
            Kiracı <code>{data.tenantId}</code>
            {data.demo ? ' · Demo' : ''}
          </p>
        </div>
        {data.demo ? <span className="platform-support-badge platform-support-badge--info">Demo</span> : null}
      </div>
      {data.lifecycle ? (
        <p className="platform-support-hint platform-support-360-lifecycle">
          {data.lifecycle.statusLabel}
          {data.lifecycle.suspended ? ' · Askıda' : ''}
          {data.lifecycle.readOnly ? ' · Salt okunur' : ''}
        </p>
      ) : null}
      {casePreview ? (
        <p className="platform-support-360-linked-case">
          Talep <strong>#{casePreview.number}</strong> · {casePreview.subject}
        </p>
      ) : null}

      {summary ? (
        <p className="platform-support-hint platform-support-360-login-stats">
          {summary.activeCount}/{summary.totalUsers} aktif kullanıcı · 30g: {summary.loginSuccess30d} başarılı,{' '}
          {summary.loginFailed30d} başarısız giriş
        </p>
      ) : null}

      <article className="platform-support-360-card platform-support-360-card--accent">
        <h4>Mağaza kullanıcıları</h4>
        {roster.length === 0 ? (
          <p className="platform-support-hint">Kullanıcı kaydı yok.</p>
        ) : (
          <table className="platform-support-360-user-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Son giriş</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'is-inactive'}>
                  <td>
                    <span className="platform-support-360-user-name">{u.displayName || u.username}</span>
                    <span className="platform-table-muted platform-support-360-user-login">{u.username}</span>
                    {u.mustChangePassword ? (
                      <span className="platform-support-tag-chip">Şifre değişmeli</span>
                    ) : null}
                  </td>
                  <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td>{formatDateTime(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="platform-support-360-card">
        <h4>Giriş geçmişi</h4>
        {logins.length === 0 ? (
          <p className="platform-support-hint">Henüz giriş kaydı yok.</p>
        ) : (
          <ul className="platform-support-360-login-list">
            {logins.map((entry, idx) => (
              <li
                key={entry.id ?? `${entry.createdAt}-${entry.username}-${idx}`}
                className={entry.success ? 'is-success' : 'is-failed'}
              >
                <span className="platform-support-360-login-time">{formatDateTime(entry.createdAt)}</span>
                <span className="platform-support-360-login-user">
                  {entry.displayName || entry.username || '—'}
                </span>
                <span className="platform-support-360-login-result">
                  {entry.success ? 'Başarılı' : 'Başarısız'}
                  {!entry.success && entry.failureReason ? ` · ${entry.failureReason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="platform-support-360-actions">
        <button type="button" className="btn btn-primary" onClick={openPos}>
          POS aç
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
          Yenile
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowOps((v) => !v)}>
          {showOps ? 'Araçları gizle' : 'Operatör araçları'}
        </button>
      </div>

      {showOps ? (
        <div className="platform-support-360-ops">
          <button type="button" className="btn btn-outline btn-sm" disabled={probeBusy} onClick={() => void runInfraProbe()}>
            {probeBusy ? 'Probe…' : 'SMTP/IMAP'}
          </button>
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
          <button
            type="button"
            className="btn btn-secondary btn-sm platform-support-360-run"
            onClick={() => void runCommand()}
            disabled={!commandLine.trim()}
          >
            Çalıştır
          </button>
        </div>
      ) : null}
    </aside>
  );
}
