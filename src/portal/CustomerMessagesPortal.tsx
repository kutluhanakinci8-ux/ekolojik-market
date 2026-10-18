import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type PortalThread = {
  id: string;
  subject: string;
  customerName: string;
  status?: string;
  lastMessageAt?: string;
};

type PortalMessage = {
  id: string;
  direction: 'staff' | 'customer';
  bodyText: string;
  authorName: string;
  createdAt: string;
  messageKind?: string | null;
};

function statusLabel(status?: string) {
  if (status === 'waiting') return 'Beklemede';
  if (status === 'closed') return 'Kapalı';
  return 'Açık';
}

function tenantQuery(tenant: string | null) {
  if (!tenant || tenant === 'main') return '';
  return `&tenant=${encodeURIComponent(tenant)}`;
}

export function CustomerMessagesPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const tenant = searchParams.get('tenant')?.trim() || 'main';

  const [thread, setThread] = useState<PortalThread | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [sessionToken, setSessionToken] = useState(token);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lookupRef, setLookupRef] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  const loadSession = useCallback(async (activeToken: string) => {
    if (!activeToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/messaging/v1/portal/session?token=${encodeURIComponent(activeToken)}${tenantQuery(tenant)}`,
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Oturum geçersiz');
        setThread(null);
        setMessages([]);
        return;
      }
      setThread(data.thread);
      setMessages(data.messages ?? []);
      setSessionToken(data.token ?? activeToken);
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (token) void loadSession(token);
    else {
      setLoading(false);
      setThread(null);
      setMessages([]);
    }
  }, [token, loadSession]);

  const portalTitle = useMemo(() => thread?.subject ?? 'Müşteri yazışmaları', [thread?.subject]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !sessionToken) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/public/messaging/v1/threads/messages?token=${encodeURIComponent(sessionToken)}${tenantQuery(tenant)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyText: text, authorName: thread?.customerName ?? 'Müşteri' }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Gönderilemedi');
        return;
      }
      setDraft('');
      await loadSession(sessionToken);
    } catch {
      setError('Gönderim hatası');
    } finally {
      setSending(false);
    }
  };

  const submitLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLookupBusy(true);
    setError(null);
    try {
      const qs = tenant && tenant !== 'main' ? `?tenant=${encodeURIComponent(tenant)}` : '';
      const res = await fetch(`/api/public/messaging/v1/portal/lookup${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: lookupRef.trim(), email: lookupEmail.trim() }),
      });
      const data = await res.json();
      if (!data.ok || !data.token) {
        setError(data.error ?? 'Kayıt bulunamadı');
        return;
      }
      const next = new URLSearchParams({ token: data.token });
      if (tenant && tenant !== 'main') next.set('tenant', tenant);
      setSearchParams(next);
    } catch {
      setError('Arama hatası');
    } finally {
      setLookupBusy(false);
    }
  };

  const closed = thread?.status === 'closed';

  return (
    <div className="portal-mesajlar-page">
      <header className="portal-mesajlar-header">
        <div>
          <p className="portal-mesajlar-kicker">Ekolojik Market</p>
          <h1>{portalTitle}</h1>
          {thread && (
            <p className="portal-mesajlar-meta">
              Durum: <strong>{statusLabel(thread.status)}</strong>
              {thread.lastMessageAt && (
                <>
                  {' '}
                  · Son güncelleme{' '}
                  {new Date(thread.lastMessageAt).toLocaleString('tr-TR')}
                </>
              )}
            </p>
          )}
        </div>
        <Link to="/" className="portal-mesajlar-home">Ana sayfa</Link>
      </header>

      {!sessionToken && (
        <section className="portal-mesajlar-card">
          <h2>Yazışmanıza erişin</h2>
          <p className="portal-mesajlar-hint">
            E-postanızdaki bağlantıyı kullanın veya iletişim formu referans numaranız ile giriş yapın.
          </p>
          <form className="portal-mesajlar-lookup" onSubmit={submitLookup}>
            <label>
              Referans (ör. C1730…)
              <input value={lookupRef} onChange={(e) => setLookupRef(e.target.value)} required />
            </label>
            <label>
              E-posta
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={lookupBusy}>
              {lookupBusy ? 'Aranıyor…' : 'Devam'}
            </button>
          </form>
        </section>
      )}

      {error && (
        <p className="portal-mesajlar-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="portal-mesajlar-hint">Yükleniyor…</p>}

      {sessionToken && thread && !loading && (
        <section className="portal-mesajlar-card portal-mesajlar-chat">
          <ul className="portal-mesajlar-messages">
            {messages.length === 0 && <li className="portal-mesajlar-empty">Henüz mesaj yok</li>}
            {messages.map((m) => (
              <li
                key={m.id}
                className={`portal-mesajlar-msg portal-mesajlar-msg--${m.direction}${
                  m.messageKind === 'bot' ? ' portal-mesajlar-msg--bot' : ''
                }`}
              >
                <div className="portal-mesajlar-msg-meta">
                  <strong>{m.authorName}</strong>
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleString('tr-TR')}
                  </time>
                </div>
                <p>{m.bodyText}</p>
              </li>
            ))}
          </ul>
          {!closed ? (
            <div className="portal-mesajlar-compose">
              <textarea
                rows={3}
                placeholder="Mesajınızı yazın…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending || !draft.trim()}
                onClick={() => void sendMessage()}
              >
                {sending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
          ) : (
            <p className="portal-mesajlar-hint">Bu talep kapatıldı. Yeni bir konu için iletişim formunu kullanın.</p>
          )}
        </section>
      )}
    </div>
  );
}
