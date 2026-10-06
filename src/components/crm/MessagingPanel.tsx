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
    if (!activeThreadId || !draft.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await postMessagingMessage(activeThreadId, {
        bodyText: draft.trim(),
        direction,
        authorName: direction === 'staff' ? authorName : customer.name,
      });
      if (!result.ok) {
        setStatus(result.error ?? 'Gönderilemedi');
        return;
      }
      setDraft('');
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
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={loading || !draft.trim()}
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
