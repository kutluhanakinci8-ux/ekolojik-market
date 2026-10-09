import type { PostaDeliverabilityHub } from '../../services/postaSettingsService';

type Props = {
  hub: PostaDeliverabilityHub;
  compact?: boolean;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function buildTurhostPasteBlock(hub: PostaDeliverabilityHub): string {
  const rows = hub.dnsChecklist ?? [];
  const lines: string[] = [
    `# Turhost DNS — ${hub.domain}`,
    `# NS: ${hub.dnsPanelGuide?.ns?.join(', ') ?? 'dns1.turhost.com, dns2.turhost.com'}`,
    '',
  ];
  for (const row of rows) {
    const host = row.panelHost ?? row.recordName;
    lines.push(`# ${row.label} (${host})`);
    lines.push(row.suggested ?? '');
    lines.push('');
  }
  lines.push(hub.dnsPanelGuide?.strictCommand ?? 'EKOLOJIK_DNS_STRICT=1 bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh');
  return lines.join('\n').trim();
}

export function PostaDnsChecklist({ hub, compact }: Props) {
  const checklist = hub.dnsChecklist ?? [];
  const missing = hub.missingDns ?? [];
  const guide = hub.dnsPanelGuide;

  if (!hub.ok) return null;

  return (
    <div className={compact ? 'posta-dns-checklist posta-dns-checklist--compact' : 'posta-dns-checklist'}>
      {!compact && (
        <p className="posta-onboarding-lead" style={{ fontSize: '0.9rem' }}>
          Gönderim alanı: <strong>{hub.domain}</strong> · From: <code>{hub.primaryFrom}</code>
          {hub.aliasesSource ? ` · alias kaynağı: ${hub.aliasesSource}` : ''}
        </p>
      )}
      {!compact && guide && (
        <p className="settings-hint" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          DNS sağlayıcı: <strong>{guide.provider}</strong> ({guide.ns.join(', ')}) — panelde üç TXT kaydı.
          Rehber: <code>{guide.docPath}</code>
        </p>
      )}
      {missing.length > 0 && (
        <p className="posta-onboarding-status warn" role="status">
          Eksik / uyarı: {missing.join(', ').toUpperCase()}
          {hub.deliverabilityReady ? '' : ' — Turhost DNS panelinde TXT yayınlayın, sonra strict doğrulama'}
        </p>
      )}
      {hub.deliverabilityReady && (
        <p className="posta-onboarding-status ok" role="status">DNS + SMTP doğrulama hazır görünüyor</p>
      )}
      {!compact && checklist.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => void copyText(buildTurhostPasteBlock(hub))}
          >
            Turhost — tüm TXT önerilerini kopyala
          </button>
        </div>
      )}
      <ul className="posta-dns-checklist__list" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
        {checklist.map((row) => (
          <li key={row.id} style={{ marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong className={row.status === 'ok' ? 'is-ok' : row.status === 'warn' ? 'is-warn' : ''}>
                {row.label}
              </strong>
              <span className="module-hint">{row.status}</span>
              {row.panelHost ? (
                <span className="module-hint">Turhost host: <code>{row.panelHost}</code></span>
              ) : null}
              <code style={{ fontSize: '0.8rem' }}>{row.recordName}</code>
              {row.suggested && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => void copyText(row.suggested ?? '')}
                >
                  Öneriyi kopyala
                </button>
              )}
            </div>
            {row.current && row.status === 'ok' && !compact && (
              <p className="settings-hint" style={{ fontSize: '0.75rem', margin: '4px 0 0' }}>
                Yayında: {row.current.slice(0, 160)}
                {row.current.length > 160 ? '…' : ''}
              </p>
            )}
            {row.suggested && !compact && (
              <pre className="posta-dns-checklist__value" style={{ fontSize: '0.75rem', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                {row.suggested}
              </pre>
            )}
          </li>
        ))}
      </ul>
      {hub.aliases?.length ? (
        <p className="settings-hint" style={{ fontSize: '0.85rem' }}>
          Posta alias: {hub.aliases.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
