import { useCallback, useEffect, useState } from 'react';
import type { Customer } from '../../types/business';
import {
  createMessagingThread,
  fetchMessagingMessages,
  fetchMessagingThreads,
  postMessagingMessage,
  type MessagingMessage,
  type MessagingThread,
} from '../../services/messagingService';

interface MessagingPanelProps {
  customer: Customer;
  authorName?: string;
}

export function MessagingPanel({ customer, authorName = 'Mağaza' }: MessagingPanelProps) {
  const [threads, setThreads] = useState<MessagingThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [direction, setDirection] = useState<'staff' | 'customer'>('staff');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ fileName: string; mimeType: string; dataBase64: string }>
  >([]);

  const readFileAsAttachment = (file: File) =>
    new Promise<{ fileName: string; mimeType: string; dataBase64: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ fileName: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: base64 });
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(file);
    });

  const loadThreads = useCallback(async () => {
    const result = await fetchMessagingThreads({ customerId: customer.id, limit: 20 });
    if (!result.ok || !result.threads) return;
    setThreads(result.threads);
    setActiveThreadId((current) => {
      if (current && result.threads!.some((t) => t.id === current)) return current;
      return result.threads![0]?.id ?? null;
    });
  }, [customer.id]);

  const loadMessages = useCallback(async (threadId: string) => {
    const result = await fetchMessagingMessages(threadId, { limit: 200 });
    if (result.ok && result.messages) {
      setMessages(result.messages);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (activeThreadId) {
      void loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId, loadMessages]);

  const startThread = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const result = await createMessagingThread({
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        subject: `${customer.name} — yazışma`,
        initialMessage: draft.trim() || undefined,
        initialDirection: direction,
        authorName,
      });
      if (!result.ok) {
        setStatus(result.error ?? 'Thread oluşturulamadı');
        return;
      }
      setDraft('');
      await loadThreads();
      if (result.thread?.id) {
        setActiveThreadId(result.thread.id);
      }
      setStatus('Yeni yazışma başlatıldı.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!activeThreadId || (!draft.trim() && pendingFiles.length === 0)) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await postMessagingMessage(activeThreadId, {
        bodyText: draft.trim(),
        direction,
        authorName: direction === 'staff' ? authorName : customer.name,
        attachments: pendingFiles.length ? pendingFiles : undefined,
      });
      if (!result.ok) {
        setStatus(result.error ?? 'Gönderilemedi');
        return;
      }
      setDraft('');
      setPendingFiles([]);
      await loadThreads();
      await loadMessages(activeThreadId);
      setStatus('Mesaj kaydedildi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crm-messaging-panel">
      <div className="crm-messaging-head">
        <h3>Mesajlar</h3>
        <p>Ekolojik içi yazışma — Nakliye Borsası thread’lerinden bağımsız</p>
      </div>

      <div className="crm-messaging-layout">
        <aside className="crm-messaging-threads">
          <button type="button" className="btn btn-sm btn-outline" disabled={loading} onClick={() => void startThread()}>
            Yeni yazışma
          </button>
          <ul>
            {threads.length === 0 ? (
              <li className="crm-messaging-empty">Henüz yazışma yok</li>
            ) : (
              threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={activeThreadId === t.id ? 'is-active' : ''}
                    onClick={() => setActiveThreadId(t.id)}
                  >
                    <strong>{t.subject}</strong>
                    <span>{t.lastMessagePreview || '—'}</span>
                    <time>{new Date(t.updatedAt).toLocaleString('tr-TR')}</time>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <div className="crm-messaging-main">
          {activeThreadId ? (
            <>
              <ul className="crm-messaging-messages">
                {messages.map((m) => (
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
                              {a.fileName} ({Math.round(a.size / 1024)} KB)
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="crm-messaging-compose">
                <label className="settings-field">
                  <span>Yön</span>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as 'staff' | 'customer')}>
                    <option value="staff">Mağaza → müşteri</option>
                    <option value="customer">Müşteri → mağaza (kayıt)</option>
                  </select>
                </label>
                <textarea
                  rows={3}
                  value={draft}
                  placeholder="Mesajınız…"
                  onChange={(e) => setDraft(e.target.value)}
                />
                <label className="settings-field">
                  <span>Ek (max 5 MB, PDF/resim)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,text/plain"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setStatus('Dosya 5 MB sınırını aşıyor');
                        return;
                      }
                      try {
                        const att = await readFileAsAttachment(file);
                        setPendingFiles((prev) => [...prev, att].slice(0, 3));
                      } catch {
                        setStatus('Ek okunamadı');
                      }
                    }}
                  />
                </label>
                {pendingFiles.length > 0 && (
                  <ul className="crm-msg-attachments">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.fileName}-${i}`}>
                        {f.fileName}
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                          Kaldır
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={loading || (!draft.trim() && pendingFiles.length === 0)}
                  onClick={() => void sendMessage()}
                >
                  Gönder
                </button>
              </div>
            </>
          ) : (
            <p className="crm-messaging-empty">Yazışma seçin veya yeni başlatın.</p>
          )}
        </div>
      </div>

      {status && <p className="crm-sms-status">{status}</p>}
    </div>
  );
}
