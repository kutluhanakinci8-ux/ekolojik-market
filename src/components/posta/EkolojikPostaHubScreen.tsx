import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../../store/useStore';
import {
  fetchEmailHealth,
  fetchOutboxMessage,
  retryOutboxMessage,
  sendEmailTest,
} from '../../services/emailOutboxService';
import {
  archivePostaInboxItem,
  fetchComposeRecipientHints,
  fetchPostaInbox,
  fetchPostaTemplates,
  fetchPostaComposeDrafts,
  savePostaComposeDraft,
  deletePostaComposeDraft,
  markPostaInboxRead,
  patchPostaInboxFlags,
  syncPostaInboxImap,
  fetchPostaSent,
  fetchPostaStorage,
  batchPostaInboxAction,
  markAllPostaInboxRead,
  type PostaStorageSummary,
  type MailTemplate,
  type PostaComposeDraft,
  type PostaInboxFolder,
  type PostaInboxItem,
  type PostaListItem,
  isPostaConversationItem,
} from '../../services/postaInboxService';
import {
  createMessagingThread,
  fetchMessagingMessages,
  fetchMessagingThreads,
  markMessagingThreadRead,
  patchMessagingThreadFlags,
  postMessagingMessage,
  type MessagingMessage,
  type MessagingThread,
} from '../../services/messagingService';
import { fetchPostaAiSuggest, fetchPostaMailSettings } from '../../services/postaSettingsService';
import { PostaComposePanel } from './PostaComposePanel';
import {
  buildForwardBody,
  buildForwardSubject,
  buildReplyAllRecipients,
  buildReplySubject,
  mergeReferences,
  type OutboundAttachment,
} from '../../utils/postaComposeClient';
import {
  deletePostaContact,
  fetchPostaContacts,
  importPostaContacts,
  postaContactsExportVcfUrl,
  savePostaContact,
  type PostaContact,
} from '../../services/postaContactsService';
import {
  addMailToPostaCalendar,
  deletePostaCalendarEvent,
  fetchPostaCalendar,
  savePostaCalendarEvent,
  syncPostaPaymentReminders,
  type PostaCalendarEvent,
} from '../../services/postaCalendarService';

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

type PostaFolder = PostaInboxFolder | 'mesajlar' | 'gonderilen' | 'yaz' | 'kisiler' | 'takvim';
type HubLayout = 'posta' | 'sohbet' | 'tam';

const INBOX_FOLDERS: PostaInboxFolder[] = [
  'tumu',
  'gelen',
  'yildizli',
  'ertelenen',
  'fatura',
  'spam',
  'arsiv',
  'cop',
  'taslaklar',
];

function isInboxMailFolder(folder: PostaFolder): folder is PostaInboxFolder {
  return (INBOX_FOLDERS as string[]).includes(folder);
}

const KIND_LABEL: Record<string, string> = {
  contact: 'İletişim formu',
  imap: 'E-posta',
  'imap-sent': 'IMAP gönderilen',
  outbox: 'Outbox',
  bill: 'Fatura',
};

function playHubMessagePing() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    /* sessiz */
  }
}

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
  const [inboxFolder, setInboxFolder] = useState<PostaInboxFolder>('gelen');
  const [hubLayout, setHubLayout] = useState<HubLayout>('posta');
  const [inboxRows, setInboxRows] = useState<PostaListItem[]>([]);
  const [mailListMode, setMailListMode] = useState<'message' | 'conversation'>('message');
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'starred' | 'attachment'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [threads, setThreads] = useState<MessagingThread[]>([]);
  const [sentRows, setSentRows] = useState<PostaInboxItem[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessagingMessage[]>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchEmailHealth>> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<OutboundAttachment[]>([]);
  const [mailSignatureHtml, setMailSignatureHtml] = useState<string | null>(null);
  const [ourMailAddresses, setOurMailAddresses] = useState<string[]>([]);
  const [composeReply, setComposeReply] = useState<{ inReplyTo?: string; references?: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [composeAiBusy, setComposeAiBusy] = useState(false);
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
  const [drafts, setDrafts] = useState<PostaComposeDraft[]>([]);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [postaContacts, setPostaContacts] = useState<PostaContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<PostaCalendarEvent[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newCalTitle, setNewCalTitle] = useState('');
  const [newCalDate, setNewCalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCalNotes, setNewCalNotes] = useState('');
  const [threadSearchQ, setThreadSearchQ] = useState('');
  const [threadShowArchived, setThreadShowArchived] = useState(false);
  const [msgSearchQ, setMsgSearchQ] = useState('');
  const prevThreadsRef = useRef<MessagingThread[]>([]);
  const [postaStorage, setPostaStorage] = useState<PostaStorageSummary | null>(null);
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [inboxOffline, setInboxOffline] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const customersForMessaging = useMemo(() => store.customers.slice(0, 500), [store.customers]);

  const composeAllHints = useMemo(() => {
    const emails = new Set(recipientHints.map((e) => e.toLowerCase()));
    for (const c of store.customers) {
      const e = c.email?.trim().toLowerCase();
      if (e?.includes('@')) emails.add(e);
    }
    return [...emails].slice(0, 200);
  }, [recipientHints, store.customers]);

  const selectedInbox = useMemo(() => {
    if (!selectedInboxId) return null;
    const row = inboxRows.find((r) => r.id === selectedInboxId);
    if (!row || isPostaConversationItem(row)) return null;
    return row;
  }, [inboxRows, selectedInboxId]);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    const row = inboxRows.find((r) => r.id === selectedConversationId);
    if (!row || !isPostaConversationItem(row)) return null;
    return row;
  }, [inboxRows, selectedConversationId]);

  const refreshInbox = useCallback(
    async (sub: PostaInboxFolder) => {
      const result = await fetchPostaInbox(sub, 80, {
        q: searchQuery.trim() || undefined,
        listMode: mailListMode,
        unread: listFilter === 'unread' ? true : undefined,
        starred: listFilter === 'starred' ? true : undefined,
        hasAttachment: listFilter === 'attachment' ? true : undefined,
      });
      if (result.ok && result.items) {
        setInboxRows(result.items);
        setInboxOffline(Boolean(result.offline));
        setImapConfigured(Boolean(result.imapConfigured));
        if (mailListMode === 'conversation') {
          setSelectedConversationId((cur) => cur ?? result.items![0]?.id ?? null);
          setSelectedInboxId(null);
        } else {
          const first = result.items.find((r) => !isPostaConversationItem(r));
          setSelectedInboxId((cur) => cur ?? first?.id ?? null);
          setSelectedConversationId(null);
        }
      }
    },
    [searchQuery, mailListMode, listFilter],
  );

  const refreshThreads = useCallback(async () => {
    const result = await fetchMessagingThreads({
      limit: 80,
      q: threadSearchQ.trim() || undefined,
      includeArchived: threadShowArchived,
    });
    if (result.ok && result.threads) {
      let shouldPing = false;
      for (const t of result.threads) {
        const prev = prevThreadsRef.current.find((p) => p.id === t.id);
        if (
          prev &&
          !t.muted &&
          t.lastMessageDirection === 'customer' &&
          t.lastMessageAt &&
          prev.lastMessageAt !== t.lastMessageAt
        ) {
          shouldPing = true;
          break;
        }
      }
      if (shouldPing && folder === 'mesajlar') playHubMessagePing();
      prevThreadsRef.current = result.threads;
      setThreads(result.threads);
      setSelectedThreadId((cur) => cur ?? result.threads![0]?.id ?? null);
    }
  }, [threadSearchQ, threadShowArchived, folder]);

  const refreshSent = useCallback(async () => {
    const recent = await fetchPostaSent(80);
    if (recent.ok && recent.items) setSentRows(recent.items);
  }, []);

  const refreshHealth = useCallback(async () => {
    const h = await fetchEmailHealth();
    setHealth(h);
    const from = h.from?.includes('@') ? [h.from] : [];
    setOurMailAddresses(from);
  }, []);

  useEffect(() => {
    void fetchPostaMailSettings().then((r) => {
      if (r.ok && r.effective?.signatureHtml) setMailSignatureHtml(r.effective.signatureHtml);
      if (r.ok && r.effective?.from?.includes('@')) {
        setOurMailAddresses((prev) => [...new Set([...prev, r.effective!.from])]);
      }
    });
  }, []);

  const refreshDrafts = useCallback(async () => {
    const result = await fetchPostaComposeDrafts();
    if (result.ok && result.drafts) setDrafts(result.drafts);
  }, []);

  const refreshContacts = useCallback(async () => {
    const result = await fetchPostaContacts(contactSearch, 120);
    if (result.ok && result.contacts) {
      setPostaContacts(result.contacts);
      setSelectedContactId((cur) => cur ?? result.contacts![0]?.id ?? null);
    }
  }, [contactSearch]);

  const refreshCalendar = useCallback(async () => {
    await syncPostaPaymentReminders(store.settings.paymentReminders ?? []);
    const result = await fetchPostaCalendar(160);
    if (result.ok && result.events) {
      setCalendarEvents(result.events);
      setSelectedCalendarId((cur) => cur ?? result.events![0]?.id ?? null);
    }
  }, [store.settings.paymentReminders]);

  useEffect(() => {
    if (!deepLinkCustomerId) return;
    setHubLayout('sohbet');
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

  const refreshStorage = useCallback(async () => {
    const r = await fetchPostaStorage();
    if (r.ok) {
      setPostaStorage({
        usedBytes: r.usedBytes ?? 0,
        quotaBytes: r.quotaBytes ?? 0,
        percent: r.percent ?? 0,
        maxAttachmentBytes: r.maxAttachmentBytes ?? 10 * 1024 * 1024,
        breakdown: r.breakdown,
      });
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/posta-offline-sw.js').catch(() => undefined);
    }
    void refreshHealth();
    void refreshStorage();
    void fetchPostaTemplates().then((r) => {
      if (r.ok && r.templates) setTemplates(r.templates);
    });
    void fetchComposeRecipientHints().then((r) => {
      if (r.ok && r.emails) setRecipientHints(r.emails);
    });
  }, [refreshHealth]);

  useEffect(() => {
    setSelectedInboxIds(new Set());
  }, [folder, inboxFolder, mailListMode]);

  const toggleInboxSelection = (id: string) => {
    setSelectedInboxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedInboxItems = useMemo(
    () =>
      inboxRows
        .filter((r) => !isPostaConversationItem(r) && selectedInboxIds.has(r.id))
        .map((r) => ({ id: r.id, kind: r.kind, sourceId: r.sourceId })),
    [inboxRows, selectedInboxIds],
  );

  const runInboxBatch = async (action: 'read' | 'archive' | 'spam' | 'trash') => {
    if (!selectedInboxItems.length) return;
    setBatchBusy(true);
    try {
      const result = await batchPostaInboxAction(action, selectedInboxItems);
      setFlash(
        result.ok
          ? `${result.processed ?? 0} kayıt işlendi${result.failed ? ` (${result.failed} hata)` : ''}`
          : result.error ?? 'Toplu işlem başarısız',
      );
      if (result.ok) {
        setSelectedInboxIds(new Set());
        await refreshInbox(inboxFolder);
        await refreshStorage();
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const markFolderAllRead = async () => {
    setBatchBusy(true);
    try {
      const result = await markAllPostaInboxRead(inboxFolder);
      setFlash(result.ok ? `${result.processed ?? 0} okundu işaretlendi` : result.error ?? 'İşlem başarısız');
      if (result.ok) await refreshInbox(inboxFolder);
    } finally {
      setBatchBusy(false);
    }
  };

  useEffect(() => {
    setFlash(null);
    if (isInboxMailFolder(folder)) {
      setInboxFolder(folder);
      void refreshInbox(folder);
    }
    if (folder === 'mesajlar') void refreshThreads();
    if (folder === 'gonderilen') void refreshSent();
    if (folder === 'taslaklar') {
      void refreshDrafts();
      void refreshInbox('taslaklar');
    }
  }, [folder, refreshInbox, refreshThreads, refreshSent, refreshDrafts, searchQuery, mailListMode, listFilter]);

  useEffect(() => {
    if (folder === 'mesajlar') void refreshThreads();
  }, [threadSearchQ, threadShowArchived, folder, refreshThreads]);

  useEffect(() => {
    if (folder === 'yaz') return undefined;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const refreshLive = () => {
      if (isInboxMailFolder(folder)) void refreshInbox(inboxFolder);
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
    const row = sentRows.find((r) => String(r.id) === selectedSentId);
    if (row && (row.kind === 'imap-sent' || row.kind === 'imap')) {
      setSentDetail(row as unknown as Record<string, unknown>);
      return;
    }
    void fetchOutboxMessage(selectedSentId).then((r) => {
      if (r.ok && r.message) setSentDetail(r.message);
    });
  }, [selectedSentId, folder, sentRows]);

  useEffect(() => {
    if (!selectedThreadId || folder !== 'mesajlar') {
      setThreadMessages([]);
      return;
    }
    void markMessagingThreadRead(selectedThreadId);
    void fetchMessagingMessages(selectedThreadId, {
      limit: 200,
      q: msgSearchQ.trim() || undefined,
    }).then((r) => {
      if (r.ok && r.messages) setThreadMessages(r.messages);
    });
  }, [selectedThreadId, folder, msgSearchQ]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const patchSelectedThread = async (flags: { pinned?: boolean; archived?: boolean; muted?: boolean }) => {
    if (!selectedThreadId) return;
    const result = await patchMessagingThreadFlags(selectedThreadId, flags);
    setFlash(result.ok ? 'Güncellendi' : result.error ?? 'İşlem başarısız');
    if (result.ok) await refreshThreads();
  };

  const openConversationItem = (row: PostaListItem) => {
    if (!isPostaConversationItem(row)) return;
    setSelectedConversationId(row.id);
    setSelectedInboxId(null);
  };

  const openInboxItem = async (row: PostaInboxItem) => {
    setSelectedConversationId(null);
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

  const ourEmailSet = useMemo(() => new Set(ourMailAddresses.map((e) => e.toLowerCase())), [ourMailAddresses]);

  const beginComposeFromRow = (row: PostaInboxItem, mode: 'reply' | 'replyAll' | 'forward', threadMessages?: PostaInboxItem[]) => {
    if (mode === 'forward') {
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject(buildForwardSubject(row.subject ?? ''));
      setComposeBody(buildForwardBody(row));
      setComposeReply(null);
      setComposeAttachments([]);
      setComposeDraftId(null);
      setFolder('yaz');
      return;
    }

    const to =
      row.kind === 'contact'
        ? String(row.from ?? '')
        : String(row.from ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? row.from ?? '';
    if (mode === 'replyAll') {
      const { to: replyTo, cc } = buildReplyAllRecipients(row, ourEmailSet, threadMessages ?? []);
      setComposeTo(replyTo || to);
      setComposeCc(cc);
      setComposeBcc('');
    } else {
      setComposeTo(to);
      setComposeCc('');
      setComposeBcc('');
    }
    setComposeSubject(buildReplySubject(row.subject ?? ''));
    setComposeBody('');
    setComposeAttachments([]);
    setComposeDraftId(null);
    const mid = row.messageId ?? null;
    if (mid) {
      setComposeReply({
        inReplyTo: mid,
        references: mergeReferences(row.references, mid),
      });
    } else {
      setComposeReply(null);
    }
    setFolder('yaz');
  };

  const startReply = (row: PostaInboxItem) => beginComposeFromRow(row, 'reply');

  const startReplyAll = (row: PostaInboxItem, threadMessages?: PostaInboxItem[]) =>
    beginComposeFromRow(row, 'replyAll', threadMessages);

  const startForward = (row: PostaInboxItem) => beginComposeFromRow(row, 'forward');

  const runComposeAiSuggest = async () => {
    setComposeAiBusy(true);
    setFlash(null);
    try {
      const result = await fetchPostaAiSuggest({
        subject: composeSubject,
        body: composeBody,
        tone: 'profesyonel',
      });
      if (result.ok && result.suggestion) {
        setComposeBody(result.suggestion);
        setFlash(`AI öneri (${result.provider ?? 'ai'}) uygulandı`);
      } else {
        setFlash(result.error ?? 'AI öneri alınamadı (EKOLOJIK_POSTA_AI=1)');
      }
    } finally {
      setComposeAiBusy(false);
    }
  };

  const sendCompose = async () => {
    setLoading(true);
    try {
      const result = await sendEmailTest({
        to: composeTo.trim(),
        cc: composeCc.trim() || undefined,
        bcc: composeBcc.trim() || undefined,
        subject: composeSubject.trim() || 'Ekolojik Market',
        body: composeBody.trim(),
        inReplyTo: composeReply?.inReplyTo,
        references: composeReply?.references,
        attachments: composeAttachments.length ? composeAttachments : undefined,
      });
      setFlash(result.ok ? 'Gönderildi / kuyruğa alındı' : result.error ?? 'Gönderilemedi');
      if (result.ok) {
        setComposeBody('');
        setComposeCc('');
        setComposeBcc('');
        setComposeAttachments([]);
        setComposeReply(null);
        if (composeDraftId) {
          await deletePostaComposeDraft(composeDraftId);
          setComposeDraftId(null);
          await refreshDrafts();
        }
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

  const patchInboxFlags = async (patch: {
    starred?: boolean;
    spam?: boolean;
    trashed?: boolean;
    snoozedUntil?: string | null;
  }) => {
    if (!selectedInbox) return;
    const result = await patchPostaInboxFlags({ id: selectedInbox.id, ...patch });
    setFlash(result.ok ? 'Güncellendi' : result.error ?? 'İşlem başarısız');
    if (result.ok) await refreshInbox(inboxFolder);
  };

  const snoozeSelectedOneDay = () => {
    const until = new Date(Date.now() + 86400000).toISOString();
    void patchInboxFlags({ snoozedUntil: until });
  };

  const openDraft = (draft: PostaComposeDraft) => {
    setComposeTo(draft.to);
    setComposeCc(draft.cc ?? '');
    setComposeBcc(draft.bcc ?? '');
    setComposeSubject(draft.subject);
    setComposeBody(draft.body);
    setComposeAttachments([]);
    setComposeDraftId(draft.id);
    setComposeReply(
      draft.inReplyTo ? { inReplyTo: draft.inReplyTo, references: draft.references ?? draft.inReplyTo } : null,
    );
    setFolder('yaz');
  };

  const persistComposeDraft = useCallback(
    async (silent = false) => {
      const result = await savePostaComposeDraft({
        id: composeDraftId ?? undefined,
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        subject: composeSubject,
        body: composeBody,
        inReplyTo: composeReply?.inReplyTo ?? null,
        references: composeReply?.references ?? null,
      });
      if (result.ok && result.draft) {
        setComposeDraftId(result.draft.id);
        if (!silent) setFlash('Taslak kaydedildi');
        await refreshDrafts();
      } else if (!silent) {
        setFlash(result.error ?? 'Taslak kaydedilemedi');
      }
    },
    [composeDraftId, composeTo, composeCc, composeBcc, composeSubject, composeBody, composeReply, refreshDrafts],
  );

  const selectedContact = useMemo(
    () => postaContacts.find((c) => c.id === selectedContactId) ?? null,
    [postaContacts, selectedContactId],
  );

  const selectedCalendarEvent = useMemo(
    () => calendarEvents.find((e) => e.id === selectedCalendarId) ?? null,
    [calendarEvents, selectedCalendarId],
  );

  useEffect(() => {
    if (folder === 'kisiler') void refreshContacts();
  }, [folder, refreshContacts]);

  useEffect(() => {
    if (folder === 'takvim') void refreshCalendar();
  }, [folder, refreshCalendar]);

  const openComposeForContact = (contact: PostaContact) => {
    setComposeTo(contact.email);
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject(`${contact.name} — Ekolojik Market`);
    setComposeBody('');
    setComposeReply(null);
    setComposeDraftId(null);
    setFolder('yaz');
  };

  const addInboxToCalendar = async (row: PostaInboxItem) => {
    const result = await addMailToPostaCalendar({
      mailId: row.id,
      subject: row.subject,
      notes: row.preview?.slice(0, 200) ?? undefined,
    });
    setFlash(result.ok ? 'Takvime eklendi' : result.error ?? 'Takvime eklenemedi');
    if (result.ok) await refreshCalendar();
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

  const FOLDER_TITLES: Record<PostaFolder, string> = {
    tumu: 'Tümü',
    gelen: 'Gelen kutusu',
    yildizli: 'Yıldızlı',
    ertelenen: 'Ertelenen',
    fatura: 'Fatura e-postaları',
    spam: 'Spam',
    arsiv: 'Arşiv',
    cop: 'Çöp',
    mesajlar: 'Yazışmalar',
    gonderilen: 'Gönderilen',
    yaz: 'Yeni e-posta',
    taslaklar: 'Taslaklar',
    kisiler: 'Kişiler',
    takvim: 'Takvim',
  };

  const listTitle = FOLDER_TITLES[folder] ?? 'Posta';

  const pickFolder = (next: PostaFolder) => {
    if (hubLayout === 'sohbet' && next !== 'mesajlar' && next !== 'yaz') {
      setHubLayout('posta');
    }
    setFolder(next);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (folder === 'yaz') return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        pickFolder('yaz');
        return;
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey && selectedInbox) {
        e.preventDefault();
        startReply(selectedInbox);
        return;
      }
      if ((e.key === 'j' || e.key === 'k') && isInboxMailFolder(folder)) {
        const rows =
          mailListMode === 'conversation'
            ? inboxRows.filter((r) => isPostaConversationItem(r))
            : inboxRows.filter((r) => !isPostaConversationItem(r));
        if (!rows.length) return;
        e.preventDefault();
        const currentId =
          mailListMode === 'conversation' ? selectedConversationId : selectedInboxId;
        const idx = rows.findIndex((r) => r.id === currentId);
        const nextIdx = e.key === 'j' ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0);
        const next = rows[Math.max(nextIdx, 0)];
        if (mailListMode === 'conversation') setSelectedConversationId(next.id);
        else if (!isPostaConversationItem(next)) setSelectedInboxId(next.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    folder,
    inboxRows,
    mailListMode,
    selectedConversationId,
    selectedInboxId,
    selectedInbox,
    startReply,
  ]);

  return (
    <div className="module-screen posta-hub-screen">
      <header className="module-header posta-hub-header">
        <div>
          <h1>Ekolojik Posta & Mesaj</h1>
          <p>Nakliye Borsası Posta menüsü ile aynı klasörler — veri ve sunucu tamamen Ekolojik</p>
        </div>
        <div className="posta-hub-view-switch" role="tablist" aria-label="Görünüm">
          {(['posta', 'sohbet', 'tam'] as HubLayout[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={hubLayout === mode}
              className={hubLayout === mode ? 'active' : ''}
              onClick={() => {
                setHubLayout(mode);
                if (mode === 'sohbet') setFolder('mesajlar');
              }}
            >
              {mode === 'posta' ? 'Posta' : mode === 'sohbet' ? 'Sohbet' : 'Tam'}
            </button>
          ))}
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
      {inboxOffline && (
        <p className="settings-flash settings-flash--pending posta-hub-offline-hint">
          Çevrimdışı — son kaydedilen gelen kutusu listesi gösteriliyor (salt okuma).
        </p>
      )}
      <p className="module-hint posta-hub-hotkeys-hint" aria-hidden="true">
        Kısayollar: <kbd>j</kbd>/<kbd>k</kbd> liste · <kbd>c</kbd> yaz · <kbd>r</kbd> yanıtla · <kbd>/</kbd> ara
      </p>

      {postaStorage && hubLayout !== 'sohbet' && (
        <div className="posta-hub-storage" role="status" aria-label="Posta depolama">
          <div className="posta-hub-storage-label">
            Depolama {postaStorage.percent}% · Ek limiti {Math.round(postaStorage.maxAttachmentBytes / (1024 * 1024))} MB
          </div>
          <div className="posta-hub-storage-track">
            <div
              className={`posta-hub-storage-fill${postaStorage.percent >= 85 ? ' is-warn' : ''}`}
              style={{ width: `${postaStorage.percent}%` }}
            />
          </div>
        </div>
      )}

      <div
        className={`posta-hub-shell${hubLayout === 'tam' ? ' posta-hub-shell--tam' : ''}${hubLayout === 'sohbet' ? ' posta-hub-shell--sohbet' : ''}${
          hubLayout === 'sohbet' && selectedThreadId && folder === 'mesajlar' ? ' posta-hub-shell--sohbet-open' : ''
        }`}
      >
        <aside className="posta-hub-folders" aria-label="Posta klasörleri">
          <button type="button" className="btn btn-primary posta-hub-compose" onClick={() => pickFolder('yaz')}>
            Yaz
          </button>
          {hubLayout !== 'sohbet' && (
            <>
              <p className="posta-hub-folder-group">Gelen</p>
              {(['tumu', 'gelen', 'yildizli', 'ertelenen'] as PostaInboxFolder[]).map((f) => (
                <button key={f} type="button" className={folder === f ? 'active' : ''} onClick={() => pickFolder(f)}>
                  {FOLDER_TITLES[f]}
                </button>
              ))}
              <p className="posta-hub-folder-group">Mağaza</p>
              <button type="button" className={folder === 'fatura' ? 'active' : ''} onClick={() => pickFolder('fatura')}>
                Fatura
              </button>
            </>
          )}
          <button type="button" className={folder === 'mesajlar' ? 'active' : ''} onClick={() => pickFolder('mesajlar')}>
            Müşteri mesajları
          </button>
          {hubLayout !== 'sohbet' && (
            <>
              <button type="button" className={folder === 'gonderilen' ? 'active' : ''} onClick={() => pickFolder('gonderilen')}>
                Gönderilen
              </button>
              <p className="posta-hub-folder-group">Diğer</p>
              {(['spam', 'arsiv', 'cop'] as PostaInboxFolder[]).map((f) => (
                <button key={f} type="button" className={folder === f ? 'active' : ''} onClick={() => pickFolder(f)}>
                  {FOLDER_TITLES[f]}
                </button>
              ))}
              <button type="button" className={folder === 'taslaklar' ? 'active' : ''} onClick={() => pickFolder('taslaklar')}>
                Taslaklar
              </button>
              <button type="button" className={folder === 'takvim' ? 'active' : ''} onClick={() => pickFolder('takvim')}>
                Takvim
              </button>
              <button type="button" className={folder === 'kisiler' ? 'active' : ''} onClick={() => pickFolder('kisiler')}>
                Kişiler
              </button>
            </>
          )}
          <div className="posta-hub-folder-meta">
            <small>SMTP</small>
            <strong>{health?.smtpVerified ? 'Hazır' : health?.smtpConfigured ? 'Hata' : 'Kapalı'}</strong>
          </div>
          {imapConfigured && isInboxMailFolder(folder) && folder !== 'cop' && folder !== 'spam' && (
            <button type="button" className="btn btn-sm btn-outline posta-hub-sync" disabled={syncBusy} onClick={() => void syncImap()}>
              {syncBusy ? 'IMAP…' : 'IMAP yenile'}
            </button>
          )}
        </aside>

        {folder !== 'yaz' && (
          <section className="posta-hub-list">
            <div className="posta-hub-list-head">
              <h2 className="posta-hub-list-title">{listTitle}</h2>
              {isInboxMailFolder(folder) && folder !== 'taslaklar' && (
                <div className="posta-hub-list-toolbar">
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="posta-hub-search"
                    placeholder="Ara (konu, gönderen, metin)…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="posta-hub-list-mode" role="tablist" aria-label="Liste modu">
                    <button
                      type="button"
                      className={mailListMode === 'message' ? 'active' : ''}
                      onClick={() => setMailListMode('message')}
                    >
                      Mesaj
                    </button>
                    <button
                      type="button"
                      className={mailListMode === 'conversation' ? 'active' : ''}
                      onClick={() => setMailListMode('conversation')}
                    >
                      Konuşma
                    </button>
                  </div>
                  {mailListMode === 'message' && (
                    <div className="posta-hub-bulk-bar">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={batchBusy}
                        onClick={() => void markFolderAllRead()}
                      >
                        Tümünü okundu işaretle
                      </button>
                      {selectedInboxIds.size > 0 && (
                        <>
                          <span className="posta-hub-bulk-count">{selectedInboxIds.size} seçili</span>
                          <button type="button" className="btn btn-sm btn-outline" disabled={batchBusy} onClick={() => void runInboxBatch('read')}>
                            Okundu
                          </button>
                          <button type="button" className="btn btn-sm btn-outline" disabled={batchBusy} onClick={() => void runInboxBatch('archive')}>
                            Arşiv
                          </button>
                          <button type="button" className="btn btn-sm btn-outline" disabled={batchBusy} onClick={() => void runInboxBatch('spam')}>
                            Spam
                          </button>
                          <button type="button" className="btn btn-sm btn-outline" disabled={batchBusy} onClick={() => void runInboxBatch('trash')}>
                            Çöp
                          </button>
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedInboxIds(new Set())}>
                            Temizle
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="posta-hub-filter-chips">
                    {(
                      [
                        ['all', 'Tümü'],
                        ['unread', 'Okunmamış'],
                        ['starred', 'Yıldızlı'],
                        ['attachment', 'Ekli'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={listFilter === key ? 'active' : ''}
                        onClick={() => setListFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {folder === 'mesajlar' && (
                <div className="posta-hub-list-toolbar">
                  <input
                    className="posta-hub-search"
                    type="search"
                    placeholder="Yazışma ara…"
                    value={threadSearchQ}
                    onChange={(e) => setThreadSearchQ(e.target.value)}
                  />
                  <div className="posta-hub-filter-chips">
                    <button
                      type="button"
                      className={!threadShowArchived ? 'active' : ''}
                      onClick={() => setThreadShowArchived(false)}
                    >
                      Aktif
                    </button>
                    <button
                      type="button"
                      className={threadShowArchived ? 'active' : ''}
                      onClick={() => setThreadShowArchived(true)}
                    >
                      Arşiv
                    </button>
                  </div>
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
                </div>
              )}
            </div>
            <ul>
              {isInboxMailFolder(folder) && inboxRows.length === 0 && (
                <li className="posta-hub-empty">Kayıt yok — iletişim formu veya IMAP sync deneyin</li>
              )}
              {isInboxMailFolder(folder) &&
                inboxRows.map((row) => (
                  <li key={row.id}>
                    {isPostaConversationItem(row) ? (
                      <button
                        type="button"
                        className={`${selectedConversationId === row.id ? 'is-active' : ''}${row.unread ? ' is-unread' : ''}`}
                        onClick={() => openConversationItem(row)}
                      >
                        <strong>
                          {row.starred ? '★ ' : ''}
                          {row.subject}
                          <span className="posta-hub-conv-count"> ({row.count})</span>
                        </strong>
                        <span>Konuşma</span>
                        <em>{row.preview.slice(0, 80)}</em>
                        <time>{row.at ? new Date(row.at).toLocaleString('tr-TR') : '—'}</time>
                      </button>
                    ) : (
                      <div className="posta-hub-list-row">
                        {mailListMode === 'message' && (
                          <input
                            type="checkbox"
                            className="posta-hub-row-check"
                            checked={selectedInboxIds.has(row.id)}
                            onChange={() => toggleInboxSelection(row.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Seç"
                          />
                        )}
                        <button
                          type="button"
                          className={`${selectedInboxId === row.id ? 'is-active' : ''}${row.unread ? ' is-unread' : ''}`}
                          onClick={() => void openInboxItem(row)}
                        >
                        <strong>
                          {row.starred ? '★ ' : ''}
                          {row.fromName || row.subject}
                        </strong>
                        <span>{KIND_LABEL[row.kind] ?? row.kind}</span>
                        <em>{row.preview.slice(0, 80)}</em>
                        <time>{row.at ? new Date(row.at).toLocaleString('tr-TR') : '—'}</time>
                        </button>
                      </div>
                    )}
                  </li>
                ))}

              {folder === 'taslaklar' && drafts.length === 0 && inboxRows.length === 0 && (
                <li className="posta-hub-empty">Taslak yok — IMAP yenile veya Yaz’dan kaydedin</li>
              )}
              {folder === 'taslaklar' &&
                inboxRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={selectedInboxId === row.id ? 'is-active' : ''}
                      onClick={() => void openInboxItem(row as PostaInboxItem)}
                    >
                      <strong>{row.subject}</strong>
                      <span>IMAP taslak</span>
                      <em>{row.preview.slice(0, 80)}</em>
                    </button>
                  </li>
                ))}
              {folder === 'taslaklar' &&
                drafts.map((d) => (
                  <li key={d.id}>
                    <button type="button" className={composeDraftId === d.id ? 'is-active' : ''} onClick={() => openDraft(d)}>
                      <strong>{d.subject || '(konu yok)'}</strong>
                      <span>{d.to || 'Alıcı yok'}</span>
                      <time>{new Date(d.updatedAt).toLocaleString('tr-TR')}</time>
                    </button>
                  </li>
                ))}

              {folder === 'kisiler' && (
                <li className="posta-hub-contacts-search">
                  <input
                    type="search"
                    placeholder="Kişi ara…"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </li>
              )}
              {folder === 'kisiler' && postaContacts.length === 0 && (
                <li className="posta-hub-empty">Kişi bulunamadı — manuel ekleyin veya içe aktarın</li>
              )}
              {folder === 'kisiler' &&
                postaContacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={selectedContactId === c.id ? 'is-active' : ''}
                      onClick={() => setSelectedContactId(c.id)}
                    >
                      <strong>{c.name}</strong>
                      <span>{c.email}</span>
                      <em>
                        {c.source === 'manual' ? 'Manuel' : c.source === 'suggested' ? 'Öneri' : 'Müşteri'}
                        {c.lastCorrespondenceAt
                          ? ` · ${new Date(c.lastCorrespondenceAt).toLocaleDateString('tr-TR')}`
                          : ''}
                      </em>
                    </button>
                  </li>
                ))}

              {folder === 'takvim' && calendarEvents.length === 0 && (
                <li className="posta-hub-empty">Takvim boş — etkinlik veya ödeme hatırlatması ekleyin</li>
              )}
              {folder === 'takvim' &&
                calendarEvents.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className={selectedCalendarId === ev.id ? 'is-active' : ''}
                      onClick={() => setSelectedCalendarId(ev.id)}
                    >
                      <div className="posta-hub-calendar-row">
                        <strong>{ev.title}</strong>
                        <span>{ev.date}</span>
                        <em>
                          {ev.kind === 'snooze'
                            ? 'E-posta erteleme'
                            : ev.kind === 'payment'
                              ? 'Ödeme'
                              : ev.kind === 'mail'
                                ? 'Posta'
                                : 'Etkinlik'}
                        </em>
                      </div>
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
                      <strong>
                        {t.pinned ? '📌 ' : ''}
                        {t.muted ? '🔕 ' : ''}
                        {t.customerName}
                      </strong>
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
                      <time>{row.at ? new Date(row.at).toLocaleString('tr-TR') : '—'}</time>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="posta-hub-detail">
          {folder === 'yaz' && (
            <PostaComposePanel
              ourEmails={ourMailAddresses}
              hints={composeAllHints}
              templates={templates}
              loading={loading}
              composeTo={composeTo}
              composeCc={composeCc}
              composeBcc={composeBcc}
              composeSubject={composeSubject}
              composeBody={composeBody}
              attachments={composeAttachments}
              signaturePreviewHtml={mailSignatureHtml}
              onChange={(patch) => {
                if (patch.to !== undefined) setComposeTo(patch.to);
                if (patch.cc !== undefined) setComposeCc(patch.cc);
                if (patch.bcc !== undefined) setComposeBcc(patch.bcc);
                if (patch.subject !== undefined) setComposeSubject(patch.subject);
                if (patch.body !== undefined) setComposeBody(patch.body);
                if (patch.attachments !== undefined) setComposeAttachments(patch.attachments);
              }}
              onSend={() => void sendCompose()}
              onSaveDraft={() => void persistComposeDraft(false)}
              autosaveDraft={() => void persistComposeDraft(true)}
              onAiSuggest={() => void runComposeAiSuggest()}
              aiBusy={composeAiBusy}
            />
          )}

          {selectedConversation && isInboxMailFolder(folder) && mailListMode === 'conversation' && (
            <>
              <div className="posta-hub-detail-actions">
                <h2>{selectedConversation.subject}</h2>
                <span className="posta-hub-conv-count">{selectedConversation.count} mesaj</span>
              </div>
              <ul className="posta-hub-conversation-thread">
                {selectedConversation.messages.map((msg) => (
                  <li key={msg.id} className="posta-hub-conv-msg">
                    <header>
                      <strong>{msg.fromName || msg.from}</strong>
                      <time>{msg.at ? new Date(msg.at).toLocaleString('tr-TR') : ''}</time>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => void openInboxItem(msg)}>
                        Aç
                      </button>
                    </header>
                    <p className="posta-hub-conv-preview">{msg.preview.slice(0, 200)}</p>
                  </li>
                ))}
              </ul>
              {selectedConversation.messages.length > 0 && (
                <div className="posta-hub-detail-buttons">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => startReply(selectedConversation.messages[selectedConversation.messages.length - 1])}
                  >
                    Yanıt
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() =>
                      startReplyAll(
                        selectedConversation.messages[selectedConversation.messages.length - 1],
                        selectedConversation.messages,
                      )
                    }
                  >
                    Tümünü yanıtla
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => startForward(selectedConversation.messages[selectedConversation.messages.length - 1])}
                  >
                    İlet
                  </button>
                </div>
              )}
            </>
          )}

          {selectedInbox && isInboxMailFolder(folder) && !selectedConversation && (
            <>
              <div className="posta-hub-detail-actions">
                <h2>{selectedInbox.subject}</h2>
                <div className="posta-hub-detail-buttons">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => startReply(selectedInbox)}>
                    Yanıt
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => startReplyAll(selectedInbox)}>
                    Tümünü yanıtla
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => startForward(selectedInbox)}>
                    İlet
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void addInboxToCalendar(selectedInbox)}>
                    Takvime ekle
                  </button>
                  {selectedInbox.kind === 'bill' && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={addBillToPaymentCalendar}>
                      Ödeme takvimine işle
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void patchInboxFlags({ starred: !selectedInbox.starred })}
                  >
                    {selectedInbox.starred ? 'Yıldızı kaldır' : 'Yıldızla'}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void snoozeSelectedOneDay()}>
                    Ertele (1 gün)
                  </button>
                  {folder !== 'spam' && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void patchInboxFlags({ spam: true })}>
                      Spam
                    </button>
                  )}
                  {folder !== 'cop' && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void patchInboxFlags({ trashed: true })}>
                      Çöp
                    </button>
                  )}
                  {folder === 'cop' && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void patchInboxFlags({ trashed: false })}>
                      Geri al
                    </button>
                  )}
                  {folder !== 'arsiv' && folder !== 'cop' && (
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
            <div className="posta-hub-sohbet-panel">
              <div className="posta-hub-detail-actions">
                <h2>{selectedThread?.subject ?? 'Mesajlar'}</h2>
                <p className="posta-hub-detail-meta">
                  {selectedThread?.customerName}
                  {selectedThread?.customerEmail ? ` · ${selectedThread.customerEmail}` : ''}
                </p>
                <div className="posta-hub-detail-buttons">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void patchSelectedThread({ pinned: !selectedThread?.pinned })}
                  >
                    {selectedThread?.pinned ? 'Sabiti kaldır' : 'Sabitle'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void patchSelectedThread({ muted: !selectedThread?.muted })}
                  >
                    {selectedThread?.muted ? 'Sesi aç' : 'Sessize al'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void patchSelectedThread({ archived: !selectedThread?.archived })}
                  >
                    {selectedThread?.archived ? 'Arşivden çıkar' : 'Arşivle'}
                  </button>
                  {selectedThread?.customerEmail && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setComposeTo(selectedThread.customerEmail ?? '');
                        setComposeSubject(`${selectedThread.customerName} — ${selectedThread.subject}`);
                        setFolder('yaz');
                      }}
                    >
                      E-posta
                    </button>
                  )}
                </div>
              </div>
              <input
                className="posta-hub-search posta-hub-msg-search"
                type="search"
                placeholder="Thread içinde ara…"
                value={msgSearchQ}
                onChange={(e) => setMsgSearchQ(e.target.value)}
              />
              <ul className="crm-messaging-messages posta-hub-sohbet-messages">
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
                  <span>Ek (max 10 MB)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,text/plain"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        setFlash('Dosya 10 MB sınırını aşıyor');
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
            </div>
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
              <pre className="posta-hub-detail-body">
                {String(sentDetail.text ?? sentDetail.bodyText ?? '')}
              </pre>
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

          {folder === 'taslaklar' && (
            <div className="posta-hub-draft-detail">
              <p className="module-hint">Taslak seçin veya Yaz ekranından yeni taslak oluşturun.</p>
              {composeDraftId && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={async () => {
                    const id = composeDraftId;
                    const result = await deletePostaComposeDraft(id);
                    setFlash(result.ok ? 'Taslak silindi' : result.error ?? 'Silinemedi');
                    if (result.ok) {
                      setComposeDraftId(null);
                      await refreshDrafts();
                    }
                  }}
                >
                  Seçili taslağı sil
                </button>
              )}
            </div>
          )}

          {folder === 'kisiler' && (
            <div className="posta-hub-contacts-detail">
              {selectedContact ? (
                <>
                  <h2>{selectedContact.name}</h2>
                  <p className="posta-hub-detail-meta">{selectedContact.email}</p>
                  {selectedContact.phone && <p className="posta-hub-detail-meta">Tel: {selectedContact.phone}</p>}
                  {selectedContact.lastCorrespondenceAt && (
                    <p className="posta-hub-detail-meta">
                      Son yazışma: {new Date(selectedContact.lastCorrespondenceAt).toLocaleString('tr-TR')}
                      {selectedContact.lastSubject ? ` — ${selectedContact.lastSubject}` : ''}
                    </p>
                  )}
                  <div className="posta-hub-detail-buttons">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openComposeForContact(selectedContact)}>
                      E-posta yaz
                    </button>
                    {selectedContact.manual && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={async () => {
                          const result = await deletePostaContact(selectedContact.id);
                          setFlash(result.ok ? 'Kişi silindi' : result.error ?? 'Silinemedi');
                          if (result.ok) {
                            setSelectedContactId(null);
                            await refreshContacts();
                          }
                        }}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="module-hint">Kişi seçin veya yeni kayıt ekleyin.</p>
              )}
              <h3 className="posta-hub-subtitle">Yeni kişi</h3>
              <label className="settings-field settings-field--full">
                <span>Ad</span>
                <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>E-posta</span>
                <input value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>Telefon</span>
                <input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
              </label>
              <div className="posta-hub-detail-buttons">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!newContactEmail.includes('@') || !newContactName.trim()}
                  onClick={async () => {
                    const result = await savePostaContact({
                      name: newContactName.trim(),
                      email: newContactEmail.trim(),
                      phone: newContactPhone.trim() || undefined,
                    });
                    setFlash(result.ok ? 'Kişi kaydedildi' : result.error ?? 'Kaydedilemedi');
                    if (result.ok) {
                      setNewContactName('');
                      setNewContactEmail('');
                      setNewContactPhone('');
                      await refreshContacts();
                    }
                  }}
                >
                  Kaydet
                </button>
                <a className="btn btn-sm btn-outline" href={postaContactsExportVcfUrl()} download>
                  vCard indir
                </a>
                <label className="btn btn-sm btn-outline posta-hub-file-btn">
                  İçe aktar
                  <input
                    type="file"
                    accept=".vcf,.csv,text/vcard,text/csv"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const text = await file.text();
                      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'vcf';
                      const result = await importPostaContacts(text, format);
                      setFlash(result.ok ? `${result.imported ?? 0} kişi içe aktarıldı` : result.error ?? 'Hata');
                      if (result.ok) await refreshContacts();
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {folder === 'takvim' && (
            <div className="posta-hub-calendar-detail">
              {selectedCalendarEvent ? (
                <>
                  <h2>{selectedCalendarEvent.title}</h2>
                  <p className="posta-hub-detail-meta">
                    {selectedCalendarEvent.date} · {selectedCalendarEvent.kind}
                    {selectedCalendarEvent.amount != null ? ` · ${selectedCalendarEvent.amount} ₺` : ''}
                  </p>
                  {selectedCalendarEvent.notes && (
                    <pre className="posta-hub-detail-body">{selectedCalendarEvent.notes}</pre>
                  )}
                  {selectedCalendarEvent.editable && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={async () => {
                        const result = await deletePostaCalendarEvent(selectedCalendarEvent.id);
                        setFlash(result.ok ? 'Etkinlik silindi' : result.error ?? 'Silinemedi');
                        if (result.ok) {
                          setSelectedCalendarId(null);
                          await refreshCalendar();
                        }
                      }}
                    >
                      Etkinliği sil
                    </button>
                  )}
                </>
              ) : (
                <p className="module-hint">Ödeme, ertelenen e-posta ve manuel etkinlikler burada listelenir.</p>
              )}
              <h3 className="posta-hub-subtitle">Manuel etkinlik</h3>
              <label className="settings-field settings-field--full">
                <span>Başlık</span>
                <input value={newCalTitle} onChange={(e) => setNewCalTitle(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>Tarih</span>
                <input type="date" value={newCalDate} onChange={(e) => setNewCalDate(e.target.value)} />
              </label>
              <label className="settings-field settings-field--full">
                <span>Not</span>
                <textarea rows={2} value={newCalNotes} onChange={(e) => setNewCalNotes(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!newCalTitle.trim()}
                onClick={async () => {
                  const result = await savePostaCalendarEvent({
                    title: newCalTitle.trim(),
                    date: newCalDate,
                    notes: newCalNotes.trim() || undefined,
                  });
                  setFlash(result.ok ? 'Etkinlik eklendi' : result.error ?? 'Eklenemedi');
                  if (result.ok) {
                    setNewCalTitle('');
                    setNewCalNotes('');
                    await refreshCalendar();
                  }
                }}
              >
                Etkinlik ekle
              </button>
            </div>
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
