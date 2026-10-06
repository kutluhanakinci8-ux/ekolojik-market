import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import {
  fetchEmailHealth,
  fetchOutboxMessage,
  fetchRecentOutbox,
  retryOutboxMessage,
  sendEmailTest,
} from '../../services/emailOutboxService';
import {
  archivePostaInboxItem,
  fetchComposeRecipientHints,
  fetchPostaInbox,
  fetchPostaTemplates,
  markPostaInboxRead,
  syncPostaInboxImap,
  type MailTemplate,
  type PostaInboxItem,
} from '../../services/postaInboxService';
import {
  fetchMessagingMessages,
  fetchMessagingThreads,
  postMessagingMessage,
  type MessagingMessage,
  type MessagingThread,
} from '../../services/messagingService';

type PostaFolder = 'gelen' | 'fatura' | 'arsiv' | 'mesajlar' | 'gonderilen' | 'yaz';
type InboxFolder = 'gelen' | 'fatura' | 'arsiv';

const KIND_LABEL: Record<string, string> = {
  contact: 'İletişim formu',
  imap: 'E-posta',
  bill: 'Fatura',
};

export function EkolojikPostaHubScreen({ store: _store }: { store: Store }) {
  const [folder, setFolder] = useState<PostaFolder>('gelen');
  const [inboxFolder, setInboxFolder] = useState<InboxFolder>('gelen');
  const [inboxRows, setInboxRows] = useState<PostaInboxItem[]>([]);
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
  const [imapConfigured, setImapConfigured] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [recipientHints, setRecipientHints] = useState<string[]>([]);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [sentDetail, setSentDetail] = useState<Record<string, unknown> | null>(null);

  const selectedInbox = useMemo(
    () => inboxRows.find((r) => r.id === selectedInboxId) ?? null,
    [inboxRows, selectedInboxId],
  );

  const refreshInbox = useCallback(async (sub: InboxFolder) => {
    const result = await fetchPostaInbox(sub, 80);
    if (result.ok && result.items) {
      setInboxRows(result.items);
      setImapConfigured(Boolean(result.imapConfigured));
      setSelectedInboxId((cur) => cur ?? result.items![0]?.id ?? null);
    }
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
      (r) => r.folder === 'sent' || r.status === 'sent' || r.status === 'failed',
    );
    setSentRows(sent as Array<Record<string, unknown>>);
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealth(await fetchEmailHealth());
  }, []);

  useEffect(() => {
    void refreshHealth();
    void fetchPostaTemplates().then((r) => {
      if (r.ok && r.templates) setTemplates(r.templates);
    });
    void fetchComposeRecipientHints().then((r) => {
      if (r.ok && r.emails) setRecipientHints(r.emails);
    });
  }, [refreshHealth]);

  useEffect(() => {
    setFlash(null);
    if (folder === 'gelen' || folder === 'fatura' || folder === 'arsiv') {
      setInboxFolder(folder);
      void refreshInbox(folder);
    }
    if (folder === 'mesajlar') void refreshThreads();
    if (folder === 'gonderilen') void refreshSent();
  }, [folder, refreshInbox, refreshThreads, refreshSent]);

  useEffect(() => {
    if (!selectedSentId || folder !== 'gonderilen') {
      setSentDetail(null);
      return;
    }
    void fetchOutboxMessage(selectedSentId).then((r) => {
      if (r.ok && r.message) setSentDetail(r.message);
    });
  }, [selectedSentId, folder]);

  useEffect(() => {
    if (!selectedThreadId || folder !== 'mesajlar') {
      setThreadMessages([]);
      return;
    }
    void fetchMessagingMessages(selectedThreadId, { limit: 200 }).then((r) => {
      if (r.ok && r.messages) setThreadMessages(r.messages);
    });
  }, [selectedThreadId, folder]);

  const openInboxItem = async (row: PostaInboxItem) => {
    setSelectedInboxId(row.id);
    if (row.unread) {
      await markPostaInboxRead({ id: row.id, kind: row.kind, sourceId: row.sourceId });
      setInboxRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, unread: false } : item)),
      );
    }
  };

  const syncImap = async () => {
    setSyncBusy(true);
    try {
      const result = await syncPostaInboxImap();
      setFlash(result.ok ? result.message ?? 'IMAP güncellendi' : result.error ?? 'Sync başarısız');
      if (result.ok) await refreshInbox(inboxFolder);
    } finally {
      setSyncBusy(false);
    }
  };

  const startReply = (row: PostaInboxItem) => {
    const to =
      row.kind === 'contact'
        ? String(row.from ?? '')
        : String(row.from ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? row.from ?? '';
    setComposeTo(to);
    const subj = row.subject?.startsWith('Re:') ? row.subject : `Re: ${row.subject}`;
    setComposeSubject(subj);
    setComposeBody('');
    setFolder('yaz');
  };

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

  const archiveSelected = async () => {
    if (!selectedInbox) return;
    const result = await archivePostaInboxItem({
      id: selectedInbox.id,
      kind: selectedInbox.kind,
      sourceId: selectedInbox.sourceId,
    });
    setFlash(result.ok ? 'Arşivlendi' : result.error ?? 'Arşivlenemedi');
    if (result.ok) {
      setSelectedInboxId(null);
      await refreshInbox(inboxFolder);
    }
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setComposeSubject(t.subject);
    setComposeBody(t.body);
  };

  const wrapComposeSelection = (before: string, after: string) => {
    const el = document.getElementById('posta-compose-body') as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? composeBody.length;
    const end = el.selectionEnd ?? composeBody.length;
    const next = composeBody.slice(0, start) + before + composeBody.slice(start, end) + after + composeBody.slice(end);
    setComposeBody(next);
  };

  const retrySent = async () => {
    if (!selectedSentId) return;
    setLoading(true);
    try {
      const result = await retryOutboxMessage(selectedSentId);
      setFlash(result.ok ? 'Yeniden kuyruğa alındı' : result.error ?? 'Retry başarısız');
      await refreshSent();
      await refreshHealth();
    } finally {
      setLoading(false);
    }
  };

  const sendThreadMessage = async () => {
    if (!selectedThreadId || !msgDraft.trim()) return;
    setMsgBusy(true);
    try {
      const result = await postMessagingMessage(selectedThreadId, {
        bodyText: msgDraft.trim(),
        direction: 'staff',
        authorName: _store.authSession?.displayName ?? 'Mağaza',
      });
      setFlash(result.ok ? 'Mesaj gönderildi' : result.error ?? 'Gönderilemedi');
      if (result.ok) {
        setMsgDraft('');
        await fetchMessagingMessages(selectedThreadId, { limit: 200 }).then((r) => {
          if (r.ok && r.messages) setThreadMessages(r.messages);
        });
        await refreshThreads();
      }
    } finally {
      setMsgBusy(false);
    }
  };

  const smtpMisconfigured =
    health?.smtpConfigured &&
    !health.smtpVerified &&
    ((health.smtpError?.includes('ECONNREFUSED') ?? false) ||
      Boolean(health.smtpHostHint?.includes('VPS IP')));

  const listTitle =
    folder === 'gelen' || folder === 'fatura' || folder === 'arsiv'
      ? folder === 'gelen'
        ? 'Gelen kutusu'
        : folder === 'fatura'
          ? 'Fatura e-postaları'
          : 'Arşiv'
      : folder === 'mesajlar'
        ? 'Yazışmalar'
        : 'Gönderilen';

  return (
    <div className="module-screen posta-hub-screen">
      <header className="module-header posta-hub-header">
        <div>
          <h1>Ekolojik Posta & Mesaj</h1>
          <p>Nakliye Borsası arayüzüne benzer — veri ve sunucu tamamen Ekolojik (NB ile paylaşılmaz)</p>
        </div>
      </header>

      {(smtpMisconfigured || health?.smtpHostHint) && !health?.smtpVerified && (
        <p className="settings-flash settings-flash--pending posta-hub-smtp-warn">
          {health?.smtpError?.includes('ECONNREFUSED') && (
            <>
              SMTP bağlantısı reddedildi. <code>EKOLOJIK_SMTP_HOST</code> genelde{' '}
              <strong>mail.ekolojikmarket.com.tr</strong> olmalı — VPS IP ancak sunucuda Postfix 587 dinliyorsa
              kullanılır.
            </>
          )}
          {health?.smtpHostHint && !health.smtpError?.includes('ECONNREFUSED') && (
            <span>{health.smtpHostHint}</span>
          )}
        </p>
      )}

      {flash && <p className="settings-flash">{flash}</p>}

      <div className="posta-hub-shell">
        <aside className="posta-hub-folders" aria-label="Posta klasörleri">
          <button type="button" className="btn btn-primary posta-hub-compose" onClick={() => setFolder('yaz')}>
            Yaz
          </button>
          <button
            type="button"
            className={folder === 'gelen' ? 'active' : ''}
            onClick={() => setFolder('gelen')}
          >
            Gelen
          </button>
          <button
            type="button"
            className={folder === 'fatura' ? 'active' : ''}
            onClick={() => setFolder('fatura')}
          >
            Fatura
          </button>
          <button
            type="button"
            className={folder === 'mesajlar' ? 'active' : ''}
            onClick={() => setFolder('mesajlar')}
          >
            Müşteri mesajları
          </button>
          <button
            type="button"
            className={folder === 'gonderilen' ? 'active' : ''}
            onClick={() => setFolder('gonderilen')}
          >
            Gönderilen
          </button>
          <button
            type="button"
            className={folder === 'arsiv' ? 'active' : ''}
            onClick={() => setFolder('arsiv')}
          >
            Arşiv
          </button>
          <div className="posta-hub-folder-meta">
            <small>SMTP</small>
            <strong>{health?.smtpVerified ? 'Hazır' : health?.smtpConfigured ? 'Hata' : 'Kapalı'}</strong>
          </div>
          {imapConfigured && (folder === 'gelen' || folder === 'fatura') && (
            <button type="button" className="btn btn-sm btn-outline posta-hub-sync" disabled={syncBusy} onClick={() => void syncImap()}>
              {syncBusy ? 'IMAP…' : 'IMAP yenile'}
            </button>
          )}
        </aside>

        {folder !== 'yaz' && (
          <section className="posta-hub-list">
            <h2 className="posta-hub-list-title">{listTitle}</h2>
            <ul>
              {(folder === 'gelen' || folder === 'fatura' || folder === 'arsiv') && inboxRows.length === 0 && (
                <li className="posta-hub-empty">Kayıt yok — iletişim formu veya IMAP sync deneyin</li>
              )}
              {(folder === 'gelen' || folder === 'fatura' || folder === 'arsiv') &&
                inboxRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`${selectedInboxId === row.id ? 'is-active' : ''}${row.unread ? ' is-unread' : ''}`}
                      onClick={() => void openInboxItem(row)}
                    >
                      <strong>{row.fromName || row.subject}</strong>
                      <span>{KIND_LABEL[row.kind] ?? row.kind}</span>
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
                    <button
                      type="button"
                      className={selectedSentId === String(row.id) ? 'is-active' : ''}
                      onClick={() => setSelectedSentId(String(row.id))}
                    >
                      <strong>{String(row.to ?? '')}</strong>
                      <span>{String(row.subject ?? '')}</span>
                      <span className="posta-hub-sent-status">{String(row.status ?? row.folder ?? '')}</span>
                      <time>
                        {row.sentAt || row.createdAt
                          ? new Date(String(row.sentAt || row.createdAt)).toLocaleString('tr-TR')
                          : '—'}
                      </time>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="posta-hub-detail">
          {folder === 'yaz' && (
            <div className="posta-hub-compose-form">
              <h2>Yeni e-posta</h2>
              {templates.length > 0 && (
                <label className="settings-field settings-field--full">
                  <span>Şablon</span>
                  <select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                    <option value="">— Seçin —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="settings-field settings-field--full">
                <span>Alıcı</span>
                <input list="posta-recipient-hints" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                <datalist id="posta-recipient-hints">
                  {recipientHints.map((email) => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
              </label>
              <label className="settings-field settings-field--full">
                <span>Konu</span>
                <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
              </label>
              <div className="posta-compose-toolbar">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('**', '**')}>
                  Kalın
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('\n- ', '')}>
                  Liste
                </button>
              </div>
              <label className="settings-field settings-field--full">
                <span>Metin</span>
                <textarea
                  id="posta-compose-body"
                  rows={8}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
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

          {selectedInbox && (folder === 'gelen' || folder === 'fatura' || folder === 'arsiv') && (
            <>
              <div className="posta-hub-detail-actions">
                <h2>{selectedInbox.subject}</h2>
                <div className="posta-hub-detail-buttons">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => startReply(selectedInbox)}>
                    Yanıt
                  </button>
                  {folder !== 'arsiv' && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void archiveSelected()}>
                      Arşivle
                    </button>
                  )}
                </div>
              </div>
              <p className="posta-hub-detail-meta">
                {KIND_LABEL[selectedInbox.kind]} · {selectedInbox.fromName || selectedInbox.from} ·{' '}
                {selectedInbox.at ? new Date(selectedInbox.at).toLocaleString('tr-TR') : ''}
              </p>
              {selectedInbox.kind === 'bill' && selectedInbox.amount != null && (
                <p className="posta-hub-detail-meta">
                  Tutar: {selectedInbox.amount} · Vade: {selectedInbox.dueDate ?? '—'}
                </p>
              )}
              {selectedInbox.bodyHtml ? (
                <div
                  className="posta-hub-detail-body posta-hub-detail-body--html"
                  dangerouslySetInnerHTML={{ __html: selectedInbox.bodyHtml }}
                />
              ) : (
                <pre className="posta-hub-detail-body">{selectedInbox.bodyText || selectedInbox.preview}</pre>
              )}
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
              <div className="posta-hub-thread-compose">
                <textarea
                  rows={3}
                  placeholder="Mesaj yazın…"
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={msgBusy || !msgDraft.trim()}
                  onClick={() => void sendThreadMessage()}
                >
                  Gönder
                </button>
              </div>
            </>
          )}

          {folder === 'gonderilen' && sentDetail && (
            <>
              <h2>{String(sentDetail.subject ?? 'Gönderilen')}</h2>
              <p className="posta-hub-detail-meta">
                {String(sentDetail.to ?? '')} · {String(sentDetail.status ?? sentDetail.folder ?? '')} ·{' '}
                {sentDetail.lastError ? `Hata: ${String(sentDetail.lastError)}` : '—'}
              </p>
              <pre className="posta-hub-detail-body">{String(sentDetail.text ?? '')}</pre>
              {(sentDetail.status === 'failed' || sentDetail.folder === 'failed') && (
                <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={() => void retrySent()}>
                  Tekrar dene
                </button>
              )}
            </>
          )}

          {folder === 'gonderilen' && !sentDetail && (
            <p className="module-hint">Listeden bir gönderim seçin — detay ve başarısız kayıtlar için tekrar dene.</p>
          )}
        </section>
      </div>
    </div>
  );
}
