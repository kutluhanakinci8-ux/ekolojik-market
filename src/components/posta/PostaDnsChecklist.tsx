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

export function PostaDnsChecklist({ hub, compact }: Props) {
  const checklist = hub.dnsChecklist ?? [];
  const missing = hub.missingDns ?? [];

  if (!hub.ok) return null;

  return (
    <div className={compact ? 'posta-dns-checklist posta-dns-checklist--compact' : 'posta-dns-checklist'}>
      {!compact && (
        <p className="posta-onboarding-lead" style={{ fontSize: '0.9rem' }}>
          Gönderim alanı: <strong>{hub.domain}</strong> · From: <code>{hub.primaryFrom}</code>
          {hub.aliasesSource ? ` · alias kaynağı: ${hub.aliasesSource}` : ''}
        </p>
      )}
      {missing.length > 0 && (
        <p className="posta-onboarding-status warn" role="status">
          Eksik / uyarı: {missing.join(', ').toUpperCase()}
          {hub.deliverabilityReady ? '' : ' — panelde TXT kayıtlarını yayınlayın'}
        </p>
      )}
      {hub.deliverabilityReady && (
        <p className="posta-onboarding-status ok" role="status">DNS + SMTP doğrulama hazır görünüyor</p>
      )}
      <ul className="posta-dns-checklist__list" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
        {checklist.map((row) => (
          <li key={row.id} style={{ marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong className={row.status === 'ok' ? 'is-ok' : row.status === 'warn' ? 'is-warn' : ''}>
                {row.label}
              </strong>
              <span className="module-hint">{row.status}</span>
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
