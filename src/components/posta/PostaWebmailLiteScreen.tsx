import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Store } from '../../store/useStore';
import {
  fetchJmapLiteEmails,
  fetchJmapLiteMailboxes,
  setJmapLiteEmails,
  type JmapLiteEmail,
} from '../../services/postaJmapLiteService';
import { fetchPostaEnterpriseCapabilities } from '../../services/postaEnterpriseService';

const FOLDERS_FALLBACK = [
  { id: 'gelen', name: 'Gelen kutusu' },
  { id: 'gonderilen', name: 'Gönderilen' },
  { id: 'fatura', name: 'Fatura' },
  { id: 'arsiv', name: 'Arşiv' },
];

type Props = {
  store: Store;
};

export function PostaWebmailLiteScreen({ store }: Props) {
  const [folders, setFolders] = useState(FOLDERS_FALLBACK);
  const [folder, setFolder] = useState('gelen');
  const [emails, setEmails] = useState<JmapLiteEmail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parity, setParity] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = emails.find((e) => e.id === selectedId) ?? null;

  const loadFolder = useCallback(async (f: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchJmapLiteEmails(f, 80);
      if (!r.ok) {
        setError(r.error ?? 'Liste alınamadı');
        setEmails([]);
        return;
      }
      setEmails(r.emails ?? []);
      setSelectedId((r.emails ?? [])[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJmapLiteMailboxes().then((r) => {
      if (r.mailboxes?.length) {
        setFolders(r.mailboxes.map((m) => ({ id: m.id, name: m.name })));
      }
    });
    void fetchPostaEnterpriseCapabilities().then((r) => {
      if (r.ok) setParity(r.overallPercent);
    });
  }, []);

  useEffect(() => {
    void loadFolder(folder);
  }, [folder, loadFolder, store.authSession?.username]);

  const markRead = async () => {
    if (!selected) return;
    await setJmapLiteEmails([{ id: selected.id, unread: false, keywords: ['$seen'] }]);
    setEmails((prev) =>
      prev.map((e) => (e.id === selected.id ? { ...e, unread: false } : e)),
    );
  };

  return (
    <div className="module-screen posta-hub-screen posta-webmail-lite">
      <header className="module-header posta-hub-header">
        <div>
          <h1>Webmail (JMAP lite)</h1>
          <p className="module-hint">
            Outlook benzeri tam ekran okuma · yazma için{' '}
            <Link to="/app?view=posta">Posta Merkezi</Link>
            {parity != null && ` · Kurumsal parite ${parity}%`}
          </p>
        </div>
        <div className="posta-hub-hero-actions">
          <Link className="btn btn-sm btn-outline" to="/app?view=posta">
            Hub’a dön
          </Link>
        </div>
      </header>
      {error && <p className="settings-flash settings-flash--pending">{error}</p>}
      <div className="posta-webmail-lite-grid">
        <nav className="posta-webmail-lite-folders" aria-label="Klasörler">
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`posta-webmail-folder${folder === f.id ? ' is-active' : ''}`}
              onClick={() => setFolder(f.id)}
            >
              {f.name}
            </button>
          ))}
        </nav>
        <ul className="posta-webmail-lite-list" aria-label="Mesaj listesi">
          {loading && <li className="posta-webmail-lite-empty">Yükleniyor…</li>}
          {!loading && emails.length === 0 && (
            <li className="posta-webmail-lite-empty">Bu klasörde mesaj yok.</li>
          )}
          {emails.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={`posta-webmail-lite-row${selectedId === e.id ? ' is-selected' : ''}${
                  e.unread ? ' is-unread' : ''
                }`}
                onClick={() => setSelectedId(e.id)}
              >
                <span className="posta-webmail-lite-subject">{e.subject || '(Konu yok)'}</span>
                <span className="posta-webmail-lite-meta">{e.from}</span>
              </button>
            </li>
          ))}
        </ul>
        <article className="posta-webmail-lite-preview">
          {!selected && <p className="posta-webmail-lite-empty">Önizlemek için bir mesaj seçin.</p>}
          {selected && (
            <>
              <header className="posta-webmail-lite-preview-head">
                <h2>{selected.subject || '(Konu yok)'}</h2>
                <p className="module-hint">{selected.from} · {selected.receivedAt}</p>
                {selected.unread && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void markRead()}>
                    Okundu işaretle
                  </button>
                )}
              </header>
              <div className="posta-webmail-lite-body">
                {selected.bodyHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: selected.bodyHtml }} />
                ) : (
                  <pre>{selected.bodyText || selected.preview || ''}</pre>
                )}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
