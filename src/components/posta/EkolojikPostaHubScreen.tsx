import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import {
  fetchEmailHealth,
  fetchRecentOutbox,
  sendEmailTest,
} from '../../services/emailOutboxService';
import { fetchBillEmailInbox } from '../../services/billEmailService';
import {
  fetchMessagingMessages,
  fetchMessagingThreads,
  type MessagingMessage,
  type MessagingThread,
} from '../../services/messagingService';

type PostaFolder = 'gelen' | 'mesajlar' | 'gonderilen' | 'yaz';

type InboxRow =
  | { kind: 'contact'; id: string; at: string; title: string; preview: string; raw: Record<string, unknown> }
  | { kind: 'bill'; id: string; at: string; title: string; preview: string; raw: Record<string, unknown> };

async function fetchContactMessages(limit = 50) {
  const res = await fetch(`/api/contact/messages?limit=${limit}`);
  return res.json() as Promise<{ ok: boolean; messages?: Array<Record<string, unknown>> }>;
}

export function EkolojikPostaHubScreen({ store: _store }: { store: Store }) {
  const [folder, setFolder] = useState<PostaFolder>('gelen');
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([]);
  const [threads, setThreads] = useState<MessagingThread[]>([]);
  const [sentRows, setSentRows] = useState<Array<Record<string, unknown>>>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessagingMessage[]>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchEmailHealth>> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInbox = useMemo(
    () => inboxRows.find((r) => r.id === selectedInboxId) ?? null,
    [inboxRows, selectedInboxId],
  );

  const refreshGelen = useCallback(async () => {
    const [contact, bill] = await Promise.all([fetchContactMessages(40), fetchBillEmailInbox(40)]);
    const rows: InboxRow[] = [];
    for (const m of contact.messages ?? []) {
      rows.push({
        kind: 'contact',
        id: `contact-${String(m.id)}`,
        at: String(m.createdAt ?? ''),
        title: String(m.name ?? 'İletişim'),
        preview: String(m.message ?? m.subject ?? ''),
        raw: m,
      });
    }
    for (const m of bill.messages ?? []) {
      rows.push({
        kind: 'bill',
        id: `bill-${String(m.id)}`,
        at: String(m.receivedAt ?? ''),
        title: String(m.subject ?? 'Fatura e-postası'),
        preview: String(m.snippet ?? m.sourceLabel ?? ''),
        raw: m as unknown as Record<string, unknown>,
      });
    }
    rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    setInboxRows(rows);
    setSelectedInboxId((cur) => cur ?? rows[0]?.id ?? null);
  }, []);

  const refreshThreads = useCallback(async () => {
    const result = await fetchMessagingThreads({ limit: 50 });
    if (result.ok && result.threads) {
      setThreads(result.threads);
      setSelectedThreadId((cur) => cur ?? result.threads![0]?.id ?? null);
    }
  }, []);

  const refreshSent = useCallback(async () => {
    const recent = await fetchRecentOutbox(80);
    const sent = (recent.items ?? []).filter(
      (r) => r.folder === 'sent' || r.status === 'sent',
    );
    setSentRows(sent as Array<Record<string, unknown>>);
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealth(await fetchEmailHealth());
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    setFlash(null);
    if (folder === 'gelen') void refreshGelen();
    if (folder === 'mesajlar') void refreshThreads();
    if (folder === 'gonderilen') void refreshSent();
  }, [folder, refreshGelen, refreshThreads, refreshSent]);

  useEffect(() => {
    if (!selectedThreadId || folder !== 'mesajlar') {
      setThreadMessages([]);
      return;
    }
    void fetchMessagingMessages(selectedThreadId, { limit: 200 }).then((r) => {
      if (r.ok && r.messages) setThreadMessages(r.messages);
    });
  }, [selectedThreadId, folder]);

  const sendCompose = async () => {
    setLoading(true);
    try {
      const result = await sendEmailTest({
        to: composeTo.trim(),
        subject: composeSubject.trim() || 'Ekolojik Market',
        body: composeBody.trim(),
      });
      setFlash(result.ok ? 'Gönderildi / kuyruğa alındı' : result.error ?? 'Gönderilemedi');
      if (result.ok) {
        setComposeBody('');
        await refreshSent();
      }
      await refreshHealth();
    } finally {
      setLoading(false);
    }
  };

  const smtpMisconfigured =
    health?.smtpConfigured &&
    !health.smtpVerified &&
    (health.smtpError?.includes('ECONNREFUSED') ?? false);

  return (
    <div className="module-screen posta-hub-screen">
      <header className="module-header posta-hub-header">
        <div>
          <h1>Ekolojik Posta & Mesaj</h1>
          <p>Nakliye Borsası arayüzüne benzer — veri ve sunucu tamamen Ekolojik (NB ile paylaşılmaz)</p>
        </div>
      </header>

      {smtpMisconfigured && (
        <p className="settings-flash settings-flash--pending posta-hub-smtp-warn">
          SMTP bağlantısı reddedildi. <code>EKOLOJIK_SMTP_HOST</code> genelde{' '}
          <strong>mail.ekolojikmarket.com.tr</strong> olmalı — VPS IP (<code>168.231…</code>) ancak sunucuda
          Postfix 587 dinliyorsa kullanılır.
        </p>
      )}

      {flash && <p className="settings-flash">{flash}</p>}

      <div className="posta-hub-shell">
        <aside className="posta-hub-folders" aria-label="Posta klasörleri">
          <button type="button" className="btn btn-primary posta-hub-compose" onClick={() => setFolder('yaz')}>
            Yaz
          </button>
          <button type="button" className={folder === 'gelen' ? 'active' : ''} onClick={() => setFolder('gelen')}>
            Gelen
          </button>
          <button type="button" className={folder === 'mesajlar' ? 'active' : ''} onClick={() => setFolder('mesajlar')}>
            Müşteri mesajları
          </button>
          <button type="button" className={folder === 'gonderilen' ? 'active' : ''} onClick={() => setFolder('gonderilen')}>
            Gönderilen
          </button>
          <div className="posta-hub-folder-meta">
            <small>SMTP</small>
            <strong>{health?.smtpVerified ? 'Hazır' : health?.smtpConfigured ? 'Hata' : 'Kapalı'}</strong>
          </div>
        </aside>

        {folder !== 'yaz' && (
          <section className="posta-hub-list">
            <h2 className="posta-hub-list-title">
              {folder === 'gelen' && 'Gelen kutusu'}
              {folder === 'mesajlar' && 'Yazışmalar'}
              {folder === 'gonderilen' && 'Gönderilen'}
            </h2>
            <ul>
              {folder === 'gelen' && inboxRows.length === 0 && <li className="posta-hub-empty">Kayıt yok</li>}
              {folder === 'gelen' &&
                inboxRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={selectedInboxId === row.id ? 'is-active' : ''}
                      onClick={() => setSelectedInboxId(row.id)}
                    >
                      <strong>{row.title}</strong>
                      <span>{row.kind === 'contact' ? 'İletişim formu' : 'Fatura e-postası'}</span>
                      <em>{row.preview.slice(0, 80)}</em>
                      <time>{row.at ? new Date(row.at).toLocaleString('tr-TR') : '—'}</time>
                    </button>
                  </li>
                ))}

              {folder === 'mesajlar' && threads.length === 0 && <li className="posta-hub-empty">Thread yok</li>}
              {folder === 'mesajlar' &&
                threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={selectedThreadId === t.id ? 'is-active' : ''}
                      onClick={() => setSelectedThreadId(t.id)}
                    >
                      <strong>{t.customerName}</strong>
                      <span>{t.subject}</span>
                      <em>{t.lastMessagePreview}</em>
                    </button>
                  </li>
                ))}

              {folder === 'gonderilen' && sentRows.length === 0 && <li className="posta-hub-empty">Gönderilen yok</li>}
              {folder === 'gonderilen' &&
                sentRows.map((row) => (
                  <li key={String(row.id)}>
                    <div className="posta-hub-sent-row">
                      <strong>{String(row.to ?? '')}</strong>
                      <span>{String(row.subject ?? '')}</span>
                      <time>
                        {row.sentAt || row.createdAt
                          ? new Date(String(row.sentAt || row.createdAt)).toLocaleString('tr-TR')
                          : '—'}
                      </time>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="posta-hub-detail">
          {folder === 'yaz' && (
            <div className="posta-hub-compose-form">
              <h2>Yeni e-posta</h2>
              <label className="settings-field settings-field--full">
                <span>Alıcı</span>
                <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>Konu</span>
                <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>Metin</span>
                <textarea rows={8} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !composeTo.includes('@')}
                onClick={() => void sendCompose()}
              >
                Gönder
              </button>
            </div>
          )}

          {folder === 'gelen' && selectedInbox && (
            <>
              <h2>{selectedInbox.title}</h2>
              <p className="posta-hub-detail-meta">
                {selectedInbox.kind === 'contact' ? 'Web iletişim formu' : 'Fatura / IMAP'} ·{' '}
                {selectedInbox.at ? new Date(selectedInbox.at).toLocaleString('tr-TR') : ''}
              </p>
              <pre className="posta-hub-detail-body">{JSON.stringify(selectedInbox.raw, null, 2)}</pre>
            </>
          )}

          {folder === 'mesajlar' && selectedThreadId && (
            <>
              <h2>{threads.find((t) => t.id === selectedThreadId)?.subject ?? 'Mesajlar'}</h2>
              <ul className="crm-messaging-messages">
                {threadMessages.map((m) => (
                  <li key={m.id} className={`crm-msg crm-msg--${m.direction}`}>
                    <header>
                      <strong>{m.authorName}</strong>
                      <time>{new Date(m.createdAt).toLocaleString('tr-TR')}</time>
                    </header>
                    <p>{m.bodyText}</p>
                  </li>
                ))}
              </ul>
              <p className="module-hint">Yeni mesaj ve ek için: Muhasebe → Müşteriler → müşteri → Mesajlar sekmesi</p>
            </>
          )}

          {folder === 'gonderilen' && (
            <p className="module-hint">Outbox gönderilen kayıtları. Detay için Ayarlar → E-posta → gönderim günlüğü.</p>
          )}
        </section>
      </div>
    </div>
  );
}
