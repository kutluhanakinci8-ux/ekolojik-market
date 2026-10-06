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
  createMessagingThread,
  fetchMessagingMessages,
  fetchMessagingThreads,
  markMessagingThreadRead,
  postMessagingMessage,
  type MessagingMessage,
  type MessagingThread,
} from '../../services/messagingService';

function readFileAsAttachment(file: File) {
  return new Promise<{ fileName: string; mimeType: string; dataBase64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ fileName: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: base64 });
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

type PostaFolder = 'gelen' | 'fatura' | 'arsiv' | 'mesajlar' | 'gonderilen' | 'yaz';
type InboxFolder = 'gelen' | 'fatura' | 'arsiv';

const KIND_LABEL: Record<string, string> = {
  contact: 'İletişim formu',
  imap: 'E-posta',
  bill: 'Fatura',
};

function billDueToIso(due?: string | null): string {
  if (!due?.trim()) return new Date().toISOString().slice(0, 10);
  const m = due.trim().match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return `${y.padStart(4, '0')}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function EkolojikPostaHubScreen({
  store,
  deepLinkCustomerId = null,
  onDeepLinkConsumed,
}: {
  store: Store;
  deepLinkCustomerId?: string | null;
  onDeepLinkConsumed?: () => void;
}) {
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
  const [composeReply, setComposeReply] = useState<{ inReplyTo?: string; references?: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [imapConfigured, setImapConfigured] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [recipientHints, setRecipientHints] = useState<string[]>([]);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [sentDetail, setSentDetail] = useState<Record<string, unknown> | null>(null);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [newThreadCustomerId, setNewThreadCustomerId] = useState('');
  const [newThreadDraft, setNewThreadDraft] = useState('');
  const [pendingMsgFiles, setPendingMsgFiles] = useState<
    Array<{ fileName: string; mimeType: string; dataBase64: string }>
  >([]);

  const customersForMessaging = useMemo(() => store.customers.slice(0, 500), [store.customers]);

  const composeAllHints = useMemo(() => {
    const emails = new Set(recipientHints.map((e) => e.toLowerCase()));
    for (const c of store.customers) {
      const e = c.email?.trim().toLowerCase();
      if (e?.includes('@')) emails.add(e);
    }
    return [...emails].slice(0, 200);
  }, [recipientHints, store.customers]);

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
    if (!deepLinkCustomerId) return;
    setFolder('mesajlar');
    void (async () => {
      const result = await fetchMessagingThreads({ customerId: deepLinkCustomerId, limit: 20 });
      if (result.ok && result.threads?.length) {
        setThreads(result.threads);
        setSelectedThreadId(result.threads[0].id);
      } else {
        setNewThreadCustomerId(deepLinkCustomerId);
        setShowNewThreadModal(true);
      }
      onDeepLinkConsumed?.();
    })();
  }, [deepLinkCustomerId, onDeepLinkConsumed]);

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
    if (folder === 'yaz') return undefined;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const refreshLive = () => {
      if (folder === 'gelen' || folder === 'fatura' || folder === 'arsiv') void refreshInbox(inboxFolder);
      if (folder === 'mesajlar') void refreshThreads();
      if (folder === 'gonderilen') void refreshSent();
    };
    try {
      es = new EventSource('/api/posta/events');
      es.onmessage = () => refreshLive();
    } catch {
      timer = setInterval(refreshLive, 15000);
    }
    return () => {
      es?.close();
      if (timer) clearInterval(timer);
    };
  }, [folder, inboxFolder, refreshInbox, refreshThreads, refreshSent]);

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
    void markMessagingThreadRead(selectedThreadId);
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
    if (row.kind === 'imap' && row.messageId) {
      setComposeReply({ inReplyTo: row.messageId, references: row.messageId });
    } else {
      setComposeReply(null);
    }
    setFolder('yaz');
  };

  const sendCompose = async () => {
    setLoading(true);
    try {
      const result = await sendEmailTest({
        to: composeTo.trim(),
        subject: composeSubject.trim() || 'Ekolojik Market',
        body: composeBody.trim(),
        inReplyTo: composeReply?.inReplyTo,
        references: composeReply?.references,
      });
      setFlash(result.ok ? 'Gönderildi / kuyruğa alındı' : result.error ?? 'Gönderilemedi');
      if (result.ok) {
        setComposeBody('');
        setComposeReply(null);
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
    setComposeReply(null);
  };

  const addBillToPaymentCalendar = () => {
    if (!selectedInbox || selectedInbox.kind !== 'bill') return;
    const amount = selectedInbox.amount ?? 0;
    if (amount <= 0) {
      setFlash('Tutar bulunamadı — manuel ekleyin');
      return;
    }
    store.addPaymentReminder({
      title: selectedInbox.subject || 'Fatura ödemesi',
      amount,
      dueDate: billDueToIso(selectedInbox.dueDate),
      scope: 'company',
      category: 'other',
      recurrence: 'once',
      notes: `Posta fatura · ${selectedInbox.id}`,
    });
    setFlash('Ödeme takvimine eklendi');
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
    if (!selectedThreadId || (!msgDraft.trim() && pendingMsgFiles.length === 0)) return;
    setMsgBusy(true);
    try {
      const result = await postMessagingMessage(selectedThreadId, {
        bodyText: msgDraft.trim(),
        direction: 'staff',
        authorName: store.authSession?.displayName ?? 'Mağaza',
        attachments: pendingMsgFiles.length ? pendingMsgFiles : undefined,
      });
      setFlash(result.ok ? 'Mesaj gönderildi' : result.error ?? 'Gönderilemedi');
      if (result.ok) {
        setMsgDraft('');
        setPendingMsgFiles([]);
        await fetchMessagingMessages(selectedThreadId, { limit: 200 }).then((r) => {
          if (r.ok && r.messages) setThreadMessages(r.messages);
        });
        await refreshThreads();
      }
    } finally {
      setMsgBusy(false);
    }
  };

  const createHubThread = async () => {
    const customer = customersForMessaging.find((c) => c.id === newThreadCustomerId);
    if (!customer) {
      setFlash('Müşteri seçin');
      return;
    }
    setMsgBusy(true);
    try {
      const result = await createMessagingThread({
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        subject: `${customer.name} — yazışma`,
        initialMessage: newThreadDraft.trim() || undefined,
        initialDirection: 'staff',
        authorName: store.authSession?.displayName ?? 'Mağaza',
      });
      if (!result.ok) {
        setFlash(result.error ?? 'Thread oluşturulamadı');
        return;
      }
      setShowNewThreadModal(false);
      setNewThreadDraft('');
      await refreshThreads();
      if (result.thread?.id) setSelectedThreadId(result.thread.id);
      setFlash('Yeni yazışma başlatıldı');
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
            <div className="posta-hub-list-head">
              <h2 className="posta-hub-list-title">{listTitle}</h2>
              {folder === 'mesajlar' && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setNewThreadCustomerId(customersForMessaging[0]?.id ?? '');
                    setShowNewThreadModal(true);
                  }}
                >
                  Yeni yazışma
                </button>
              )}
            </div>
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
                      className={`${selectedThreadId === t.id ? 'is-active' : ''}${
                        t.lastMessageDirection === 'customer' ? ' is-unread' : ''
                      }`}
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
                  {composeAllHints.map((email) => (
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
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => wrapComposeSelection('[', '](https://)')}
                >
                  Link
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
                  {selectedInbox.kind === 'bill' && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={addBillToPaymentCalendar}>
                      Ödeme takvimine işle
                    </button>
                  )}
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
              {selectedInbox.attachments?.length ? (
                <ul className="crm-msg-attachments">
                  {selectedInbox.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/posta/inbox/${encodeURIComponent(selectedInbox.id)}/attachment/${encodeURIComponent(a.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.fileName}
                        {a.size ? ` (${Math.round(a.size / 1024)} KB)` : ''}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
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
                    {m.attachments?.length ? (
                      <ul className="crm-msg-attachments">
                        {m.attachments.map((a) => (
                          <li key={a.id}>
                            <a href={a.url} target="_blank" rel="noreferrer">
                              {a.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
                <label className="settings-field settings-field--full">
                  <span>Ek (max 5 MB)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,text/plain"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setFlash('Dosya 5 MB sınırını aşıyor');
                        return;
                      }
                      try {
                        const att = await readFileAsAttachment(file);
                        setPendingMsgFiles((prev) => [...prev, att].slice(0, 3));
                      } catch {
                        setFlash('Ek okunamadı');
                      }
                    }}
                  />
                </label>
                {pendingMsgFiles.length > 0 && (
                  <ul className="crm-msg-attachments">
                    {pendingMsgFiles.map((f, i) => (
                      <li key={`${f.fileName}-${i}`}>
                        {f.fileName}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setPendingMsgFiles((p) => p.filter((_, j) => j !== i))}
                        >
                          Kaldır
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={msgBusy || (!msgDraft.trim() && pendingMsgFiles.length === 0)}
                  onClick={() => void sendThreadMessage()}
                >
                  Gönder
                </button>
              </div>
            </>
          )}

          {folder === 'mesajlar' && !selectedThreadId && (
            <p className="module-hint">Yazışma seçin veya yeni başlatın.</p>
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

      {showNewThreadModal && (
        <div className="posta-hub-modal-backdrop" role="presentation" onClick={() => setShowNewThreadModal(false)}>
          <div
            className="posta-hub-modal"
            role="dialog"
            aria-labelledby="posta-new-thread-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="posta-new-thread-title">Yeni müşteri yazışması</h2>
            <label className="settings-field settings-field--full">
              <span>Müşteri</span>
              <select value={newThreadCustomerId} onChange={(e) => setNewThreadCustomerId(e.target.value)}>
                <option value="">— Seçin —</option>
                {customersForMessaging.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field settings-field--full">
              <span>İlk mesaj (isteğe bağlı)</span>
              <textarea rows={4} value={newThreadDraft} onChange={(e) => setNewThreadDraft(e.target.value)} />
            </label>
            <div className="posta-hub-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowNewThreadModal(false)}>
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={msgBusy || !newThreadCustomerId}
                onClick={() => void createHubThread()}
              >
                Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
