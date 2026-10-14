import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPlatformSupportCaseFromContact,
  createPlatformSupportCaseFromInbox,
  createPlatformSupportCaseFromQueue,
  createPlatformSupportCaseManual,
  fetchPlatformSupportCommands,
  downloadPlatformSupportCsv,
  downloadPlatformSupportCaseActivityCsv,
  downloadPlatformSupportInboxAttachment,
  openPlatformSupportCaseActivityPrint,
  fetchPlatformSupportCaseDetail,
  fetchPlatformSupportMacros,
  savePlatformSupportMacros,
  fetchPlatformSupportCases,
  fetchPlatformSupportContactQueue,
  fetchPlatformSupportInbox,
  fetchPlatformSupportOverview,
  fetchPlatformSupportZendeskBridge,
  createPlatformSupportCaseZendesk,
  pushPlatformSupportCaseZendesk,
  syncPlatformSupportCaseZendeskStatus,
  fetchPlatformSupportCaseAi,
  postPlatformSupportCaseAction,
  postPlatformSupportCommand,
  replyPlatformSupportInbox,
  savePlatformSupportSlaPolicy,
  syncPlatformSupportInbox,
  updatePlatformSupportCase,
  type PlatformSupportCase,
  type PlatformSupportCaseDetail,
  type PlatformSupportCommandHelp,
  type PlatformSupportContactQueueItem,
  type PlatformSupportInboxAttachment,
  type PlatformSupportInboxMessage,
  type PlatformSupportPayload,
  type ClosedCaseInboundMode,
  type PlatformSupportSlaPolicy,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';
import { PlatformSupportTenant360 } from './PlatformSupportTenant360';
import { PlatformSupportSlaLive } from './PlatformSupportSlaLive';
import { buildCaseUnifiedTimeline, type CaseTimelineEntry } from './platformSupportCaseTimeline';
import {
  filterCaseActivities,
  type PlatformSupportActivityFilter,
} from './platformSupportActivityFilter';

const KIND_LABELS: Record<string, string> = {
  first_response: 'İlk yanıt bekliyor',
  stale_waiting: 'Beklemede (eski)',
};

function SupportEmailHtmlFrame({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      className="platform-support-email-html-frame"
      sandbox=""
      srcDoc={html}
      title={title}
    />
  );
}

function formatAttachmentSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SupportInboxAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: PlatformSupportInboxAttachment[];
}) {
  if (!attachments.length) return null;
  return (
    <ul className="platform-support-attachments">
      {attachments.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            className="platform-support-attachment-btn"
            onClick={() => void downloadPlatformSupportInboxAttachment(messageId, a.id, a.fileName)}
          >
            {a.fileName}
            {a.size ? <span className="platform-table-muted"> ({formatAttachmentSize(a.size)})</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CaseTimelineItem({ entry }: { entry: CaseTimelineEntry }) {
  if (entry.kind === 'email_in') {
    return (
      <li className="is-email-in">
        <header>
          <span>{entry.label}</span>
          <span>{formatDateTime(entry.at)}</span>
        </header>
        <p className="platform-table-muted">{entry.from}</p>
        <p className="platform-support-case-email-body">{entry.bodyText}</p>
        <SupportInboxAttachments messageId={entry.inboxMessageId} attachments={entry.attachments ?? []} />
        {entry.bodyHtml ? (
          <details className="platform-support-email-html-details">
            <summary>HTML önizleme</summary>
            <SupportEmailHtmlFrame html={entry.bodyHtml} title={`Gelen mail ${entry.inboxMessageId}`} />
          </details>
        ) : null}
      </li>
    );
  }
  if (entry.kind === 'email_out') {
    return (
      <li className="is-email-out">
        <header>
          <span>{entry.label}</span>
          <span>{formatDateTime(entry.at)}</span>
        </header>
        {entry.bodyText ? <p className="platform-support-case-email-body">{entry.bodyText}</p> : null}
        {entry.bodyHtml ? (
          <details className="platform-support-email-html-details">
            <summary>HTML önizleme</summary>
            <SupportEmailHtmlFrame html={entry.bodyHtml} title="Giden e-posta" />
          </details>
        ) : null}
        {entry.messageId ? <code className="platform-support-mono-truncate">{entry.messageId}</code> : null}
      </li>
    );
  }
  const who =
    entry.direction === 'customer'
      ? 'Müşteri'
      : entry.direction === 'staff'
        ? 'Kasa'
        : entry.authorName || 'Mesaj';
  return (
    <li className="is-messaging">
      <header>
        <span>Mesajlaşma · {who}</span>
        <span>{formatDateTime(entry.at)}</span>
      </header>
      <p className="platform-support-case-email-body">{entry.bodyText}</p>
    </li>
  );
}

const SEV_LABELS: Record<string, string> = {
  critical: 'Kritik',
  warning: 'Uyarı',
  info: 'Normal',
};

const CLOSED_CASE_INBOUND_PREVIEW: Record<
  ClosedCaseInboundMode,
  { summary: string; customer: string; ops: string }
> = {
  reopen: {
    summary: 'Kapalı/çözüldü kayda gelen mail kaydı tekrar açar; aktivite gelen e-posta olarak eklenir.',
    customer: 'Müşteri aynı kayıt numarasıyla yazışmaya devam eder.',
    ops: 'Tek kayıt; SLA yeniden işler.',
  },
  keep_closed: {
    summary: 'Kayıt kapalı kalır; mail arşiv aktivitesi (email_inbound_closed) eklenir.',
    customer: 'Otomatik yanıt yok — gerekirse manuel iletişim.',
    ops: 'Raporlarda görünür; kayıt yeniden açılmaz.',
  },
  new_case: {
    summary: 'Yeni destek kaydı açılır; müşteriye şablon bildirim, ops@ iç uyarı gider.',
    customer: 'Yeni kayıt numarası ve referans ile bilgilendirilir.',
    ops: 'Eski kayıt kapalı; spawn + ops bildirimi.',
  },
};

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)} sn`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk`;
  return `${(ms / 3600_000).toFixed(1)} sa`;
}

function userMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const msg = (err as { message?: unknown; error?: unknown }).message ?? (err as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function SupportSkeleton() {
  return (
    <div className="platform-support platform-support--premium platform-support--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformSupportTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformSupportPayload | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [exporting, setExporting] = useState(false);
  const [activityExporting, setActivityExporting] = useState<'csv' | 'html' | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PlatformSupportSlaPolicy | null>(null);
  const [activityFilter, setActivityFilter] = useState<PlatformSupportActivityFilter>('all');
  const [manualCaseOpen, setManualCaseOpen] = useState(false);
  const [manualCaseDraft, setManualCaseDraft] = useState({
    subject: '',
    kind: 'request',
    requesterEmail: '',
    requesterName: '',
    tenantId: '',
    notes: '',
  });
  const [manualCaseSaving, setManualCaseSaving] = useState(false);
  const [headerCommandLine, setHeaderCommandLine] = useState('');
  const [commandHelp, setCommandHelp] = useState<PlatformSupportCommandHelp[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'all' | 'first_response' | 'stale_waiting'>('all');
  const [section, setSection] = useState<'inbox' | 'queue' | 'cases' | 'sla'>('cases');
  const [caseRows, setCaseRows] = useState<PlatformSupportCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseListStatus, setCaseListStatus] = useState<string>('all');
  const [caseListKind, setCaseListKind] = useState<string>('all');
  const [caseMetaDraft, setCaseMetaDraft] = useState({
    status: 'open',
    priority: 'normal',
    kind: 'request',
    assignee: '',
    tags: '',
  });
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'attachments'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [caseMetaSaving, setCaseMetaSaving] = useState(false);
  const [zendeskIdDraft, setZendeskIdDraft] = useState('');
  const [zendeskApiReady, setZendeskApiReady] = useState(false);
  const [zendeskPushing, setZendeskPushing] = useState(false);
  const [zendeskCreating, setZendeskCreating] = useState(false);
  const [zendeskSyncing, setZendeskSyncing] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<PlatformSupportInboxMessage[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [mailboxConfigured, setMailboxConfigured] = useState(false);
  const [mailboxAddress, setMailboxAddress] = useState<string | null>(null);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [inboxSyncing, setInboxSyncing] = useState(false);
  const [inboxCaseCreating, setInboxCaseCreating] = useState(false);
  const [caseNotesDraft, setCaseNotesDraft] = useState('');
  const [caseNotesSaving, setCaseNotesSaving] = useState(false);
  const [caseDetail, setCaseDetail] = useState<PlatformSupportCaseDetail | null>(null);
  const [replyChannel, setReplyChannel] = useState<'note' | 'email' | 'messaging'>('email');
  const [actionDraft, setActionDraft] = useState('');
  const [contactQueue, setContactQueue] = useState<PlatformSupportContactQueueItem[]>([]);
  const [contextTenantId, setContextTenantId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [macroPick, setMacroPick] = useState('');
  const [macroEditorOpen, setMacroEditorOpen] = useState(false);
  const [macroDraft, setMacroDraft] = useState<Array<{ id: string; label: string; body: string }>>([]);
  const [macroSaving, setMacroSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformSupportOverview(windowDays);
    if (!result.ok || !result.data) {
      setError(userMessage(result.error, 'Veri yüklenemedi'));
      setLoading(false);
      return;
    }
    setData(result.data);
    setInboxUnread(result.data.inbox?.unread ?? 0);
    setMailboxConfigured(result.data.capabilities.supportMailboxConfigured === true);
    setMailboxAddress(result.data.capabilities.supportMailboxAddress ?? null);
    const inboxRes = await fetchPlatformSupportInbox();
    if (inboxRes.ok && inboxRes.data) {
      setInboxMessages(inboxRes.data.messages);
      setInboxUnread(inboxRes.data.unread);
      setMailboxConfigured(inboxRes.data.mailbox.configured);
      setMailboxAddress(inboxRes.data.mailbox.address);
    }
    setPolicyDraft({
      firstResponseTargetMinutes: result.data.policy.firstResponseTargetMinutes,
      staleWaitingHours: result.data.policy.staleWaitingHours,
      closedCaseInbound: result.data.policy.closedCaseInbound ?? 'reopen',
    });
    const casesRes = await fetchPlatformSupportCases(caseListStatus, caseListKind);
    if (casesRes.ok && casesRes.data) {
      setCaseRows(casesRes.data.cases);
    }
    const contactRes = await fetchPlatformSupportContactQueue();
    if (contactRes.ok && contactRes.data) {
      setContactQueue(contactRes.data.items);
    }
    const zendeskRes = await fetchPlatformSupportZendeskBridge();
    setZendeskApiReady(Boolean(zendeskRes.ok && zendeskRes.data?.apiConfigured));
    const cmdRes = await fetchPlatformSupportCommands();
    if (cmdRes.ok && cmdRes.commands?.length) setCommandHelp(cmdRes.commands);
    setLoading(false);
  }, [windowDays, caseListStatus, caseListKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const c = caseRows.find((row) => row.id === selectedCaseId);
    const tid = c?.tenantId ?? c?.links?.tenantId ?? null;
    if (tid) setContextTenantId(tid);
  }, [selectedCaseId, caseRows]);

  useEffect(() => {
    setShowAllActivity(false);
  }, [selectedCaseId, activityFilter]);

  const selectedCase = caseRows.find((c) => c.id === selectedCaseId) ?? null;

  useEffect(() => {
    if (!selectedCase) return;
    setCaseMetaDraft({
      status: selectedCase.status,
      priority: selectedCase.priority,
      kind: selectedCase.kind,
      assignee: selectedCase.assignee ?? '',
      tags: (selectedCase.tags ?? []).join(', '),
    });
    setCaseNotesDraft(selectedCase.notes ?? '');
  }, [
    selectedCase?.id,
    selectedCase?.status,
    selectedCase?.priority,
    selectedCase?.kind,
    selectedCase?.assignee,
    selectedCase?.tags,
    selectedCase?.notes,
  ]);

  useEffect(() => {
    if (!selectedCaseId) {
      setCaseDetail(null);
      return;
    }
    void (async () => {
      const res = await fetchPlatformSupportCaseDetail(selectedCaseId);
      if (res.ok && res.data) {
        setCaseDetail(res.data);
        const c = res.data.case;
        if (c.links?.threadId && c.links?.tenantId) setReplyChannel('messaging');
        else if (c.links?.inboxMessageId || c.requesterEmail) setReplyChannel('email');
        else setReplyChannel('note');
      }
    })();
  }, [selectedCaseId]);

  const caseUnifiedTimeline = useMemo(
    () => buildCaseUnifiedTimeline(caseDetail),
    [caseDetail],
  );

  const filteredCaseActivity = useMemo(() => {
    const items = caseDetail?.case.activity ?? [];
    return filterCaseActivities(items, activityFilter);
  }, [caseDetail?.case.activity, activityFilter]);

  const activityTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      email_inbound: 'Gelen e-posta',
      email_inbound_closed: 'Gelen (kapalı kayıt)',
      email_outbound: 'Giden e-posta',
      email_out: 'Giden e-posta',
      case_spawned: 'Yeni kayıt (politika)',
      case_updated: 'Kayıt güncelleme',
      zendesk_webhook: 'Zendesk (webhook)',
      zendesk_push: 'Zendesk (platform →)',
      note: 'İç not',
      messaging_out: 'Mesajlaşma (giden)',
    };
    return map[type] ?? type;
  };

  const activityFilterLabel = (filter: PlatformSupportActivityFilter) => {
    const map: Record<PlatformSupportActivityFilter, string> = {
      all: 'Tümü',
      email_inbound: 'Gelen e-posta',
      email_outbound: 'Giden e-posta',
      note: 'İç not',
      zendesk: 'Zendesk',
      case_meta: 'Kayıt / politika',
      messaging: 'Mesajlaşma',
    };
    return map[filter];
  };

  const runHeaderCommand = async () => {
    const line = headerCommandLine.trim();
    if (!line) return;
    const tenantId = contextTenantId ?? undefined;
    const res = await postPlatformSupportCommand(
      tenantId ? { tenantId, line } : { line },
    );
    if (!res.ok) {
      const hint = res.hints?.length ? ` (${res.hints.join(', ')})` : '';
      setPolicyMsg(`${userMessage(res.error, 'Komut başarısız')}${hint}`);
      return;
    }
    setPolicyMsg('Komut uygulandı');
    setHeaderCommandLine('');
    void load();
  };

  const submitManualCase = async () => {
    const subject = manualCaseDraft.subject.trim();
    if (!subject) {
      setPolicyMsg('Konu gerekli');
      return;
    }
    setManualCaseSaving(true);
    const result = await createPlatformSupportCaseManual({
      subject,
      kind: manualCaseDraft.kind as PlatformSupportCase['kind'],
      requesterEmail: manualCaseDraft.requesterEmail.trim() || undefined,
      requesterName: manualCaseDraft.requesterName.trim() || undefined,
      tenantId: manualCaseDraft.tenantId.trim() || contextTenantId || null,
      notes: manualCaseDraft.notes.trim() || undefined,
    });
    setManualCaseSaving(false);
    if (!result.ok || !result.case) {
      setPolicyMsg(userMessage(result.error, 'Kayıt oluşturulamadı'));
      return;
    }
    setPolicyMsg(`Kayıt #${result.case.number} oluşturuldu`);
    setManualCaseOpen(false);
    setManualCaseDraft({
      subject: '',
      kind: 'request',
      requesterEmail: '',
      requesterName: '',
      tenantId: '',
      notes: '',
    });
    setSection('cases');
    setSelectedCaseId(result.case.id);
    void load();
  };

  const ACTIVITY_LIST_CAP = 24;
  const visibleCaseActivity = useMemo(() => {
    if (showAllActivity) return filteredCaseActivity;
    return filteredCaseActivity.slice(0, ACTIVITY_LIST_CAP);
  }, [filteredCaseActivity, showAllActivity]);

  const filteredQueue = useMemo(() => {
    if (!data) return [];
    if (queueFilter === 'all') return data.queue;
    return data.queue.filter((q) => q.kind === queueFilter);
  }, [data, queueFilter]);

  const savePolicy = async () => {
    if (!policyDraft) return;
    setPolicyMsg(null);
    const result = await savePlatformSupportSlaPolicy(policyDraft);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Kaydedilemedi'));
      return;
    }
    setPolicyMsg('SLA eşikleri kaydedildi');
    void load();
  };

  const selectedMail = inboxMessages.find((m) => m.id === selectedMailId) ?? null;
  const selectedMailThreadRootId = selectedMail?.threadRootId || selectedMail?.id;
  const selectedMailCase =
    selectedMail
      ? caseRows.find((c) => c.links?.inboxMessageId === selectedMailThreadRootId) ?? null
      : null;

  const inboxThreadKey = (m: PlatformSupportInboxMessage) => m.threadRootId || m.id;

  const inboxThreads = useMemo(() => {
    const map = new Map<string, PlatformSupportInboxMessage[]>();
    for (const m of inboxMessages) {
      const key = inboxThreadKey(m);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    const threads = [...map.entries()].map(([key, msgs]) => {
      const sorted = [...msgs].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
      return { key, messages: sorted, head: sorted[0], count: sorted.length };
    });
    threads.sort((a, b) => Date.parse(b.head.receivedAt) - Date.parse(a.head.receivedAt));
    return threads;
  }, [inboxMessages]);

  const filteredInboxThreads = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    return inboxThreads.filter(({ head, messages }) => {
      if (inboxFilter === 'unread' && head.readAt) return false;
      if (inboxFilter === 'attachments') {
        const has = messages.some((m) => (m.attachments?.length ?? 0) > 0);
        if (!has) return false;
      }
      if (!q) return true;
      const blob = [head.subject, head.from, head.snippet, head.bodyText, ...messages.map((m) => m.bodyText)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [inboxThreads, inboxFilter, inboxSearch]);

  const caseByMessagingThread = useMemo(() => {
    const map = new Map<string, PlatformSupportCase>();
    for (const c of caseRows) {
      const tenantId = c.links?.tenantId ?? c.tenantId;
      const threadId = c.links?.threadId;
      if (!tenantId || !threadId) continue;
      if (c.status === 'closed' || c.status === 'solved') continue;
      map.set(`${tenantId}:${threadId}`, c);
    }
    return map;
  }, [caseRows]);

  const selectedThreadMessages = useMemo(() => {
    if (!selectedMail) return [];
    const key = inboxThreadKey(selectedMail);
    const thread = inboxThreads.find((t) => t.key === key);
    const msgs = thread?.messages ?? [selectedMail];
    return [...msgs].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  }, [selectedMail, inboxThreads]);

  const replyTargetMailId =
    selectedThreadMessages.length > 0
      ? selectedThreadMessages[selectedThreadMessages.length - 1].id
      : selectedMailId;

  const onInboxSync = async () => {
    setInboxSyncing(true);
    setPolicyMsg(null);
    const result = await syncPlatformSupportInbox();
    setInboxSyncing(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Senkron başarısız'));
      return;
    }
    setPolicyMsg(result.message ?? 'Gelen kutusu güncellendi');
    void load();
  };

  const onReply = async () => {
    if (!replyTargetMailId || !replyDraft.trim()) return;
    const result = await replyPlatformSupportInbox(replyTargetMailId, replyDraft.trim());
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Yanıt gönderilemedi'));
      return;
    }
    setReplyDraft('');
    setPolicyMsg('Yanıt destek@ üzerinden gönderildi');
    void load();
  };

  const openCaseFromQueue = async (q: PlatformSupportPayload['queue'][0]) => {
    const existing = caseByMessagingThread.get(`${q.tenantId}:${q.threadId}`);
    if (existing) {
      setSelectedCaseId(existing.id);
      setSection('cases');
      setPolicyMsg(`Mevcut kayıt #${existing.number}`);
      return;
    }
    const result = await createPlatformSupportCaseFromQueue({
      tenantId: q.tenantId,
      threadId: q.threadId,
      businessName: q.businessName,
      subject: q.subject,
      customerName: q.customerName,
    });
    if (!result.ok || !result.case) {
      setPolicyMsg(userMessage(result.error, 'Talep oluşturulamadı'));
      return;
    }
    setPolicyMsg(
      result.duplicate
        ? `Mevcut kayıt #${result.case.number}`
        : `Talep kaydı #${result.case.number} oluşturuldu`,
    );
    setSelectedCaseId(result.case.id);
    setSection('cases');
    void load();
  };

  const runCaseAi = async (
    kind: 'summary' | 'draft_reply' | 'apply_macro' | 'personalize_macro' | 'refine_draft',
    options?: { macroId?: string },
  ) => {
    if (!selectedCaseId) return;
    setAiBusy(true);
    setPolicyMsg(null);
    const res = await fetchPlatformSupportCaseAi(selectedCaseId, kind, {
      macroId: options?.macroId ?? (macroPick || undefined),
      draft: kind === 'refine_draft' ? actionDraft : undefined,
    });
    setAiBusy(false);
    if (!res.ok) {
      setPolicyMsg(userMessage(res.error, 'AI önerisi alınamadı'));
      return;
    }
    if (kind === 'summary' && res.text) {
      setAiSummary(res.text);
      setPolicyMsg(res.provider === 'external' ? 'AI özet hazır' : 'Yerel özet hazır');
      return;
    }
    if (res.text && kind !== 'summary') {
      setActionDraft(res.text);
      if (kind !== 'refine_draft') setReplyChannel('email');
      const labels: Record<string, string> = {
        draft_reply: res.provider === 'external' ? 'AI yanıt taslağı hazır' : 'Yerel taslak hazır',
        apply_macro: 'Makro dolduruldu',
        personalize_macro:
          res.provider === 'external' ? 'Makro AI ile kişiselleştirildi' : 'Makro dolduruldu',
        refine_draft: res.provider === 'external' ? 'Taslak AI ile düzenlendi' : 'Taslak korundu',
      };
      setPolicyMsg(labels[kind] ?? 'Hazır');
    }
  };

  const sendCaseAction = async () => {
    if (!selectedCaseId || !actionDraft.trim()) return;
    const result = await postPlatformSupportCaseAction(selectedCaseId, {
      channel: replyChannel,
      body: actionDraft.trim(),
    });
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Gönderilemedi'));
      return;
    }
    setActionDraft('');
    setPolicyMsg(
      replyChannel === 'note' ? 'İç not kaydedildi' : replyChannel === 'email' ? 'E-posta gönderildi' : 'Mesaj gönderildi',
    );
    void load();
    const detail = await fetchPlatformSupportCaseDetail(selectedCaseId);
    if (detail.ok && detail.data) setCaseDetail(detail.data);
  };

  const openCaseFromContact = async (contactId: string) => {
    const result = await createPlatformSupportCaseFromContact(contactId);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Talep oluşturulamadı'));
      return;
    }
    setPolicyMsg('İletişim formundan talep oluşturuldu');
    setSection('cases');
    void load();
  };

  const saveCaseZendesk = async () => {
    if (!selectedCaseId) return;
    const id = zendeskIdDraft.trim();
    const result = await updatePlatformSupportCase(selectedCaseId, {
      externalTicketRef: id ? { provider: 'zendesk', id, url: null } : null,
    });
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Kaydedilemedi'));
      return;
    }
    setPolicyMsg('Zendesk referansı kaydedildi');
    void load();
  };

  const refreshCaseDetail = async () => {
    if (!selectedCaseId) return;
    const detail = await fetchPlatformSupportCaseDetail(selectedCaseId);
    if (detail.ok && detail.data) setCaseDetail(detail.data);
    void load();
  };

  const pushCaseToZendesk = async () => {
    if (!selectedCaseId) return;
    setZendeskPushing(true);
    const result = await pushPlatformSupportCaseZendesk(selectedCaseId);
    setZendeskPushing(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Zendesk gönderimi başarısız'));
      return;
    }
    setPolicyMsg(`Zendesk #${result.ticketId ?? zendeskIdDraft} güncellendi`);
    void refreshCaseDetail();
  };

  const createCaseZendeskTicket = async () => {
    if (!selectedCaseId) return;
    setZendeskCreating(true);
    const result = await createPlatformSupportCaseZendesk(selectedCaseId);
    setZendeskCreating(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Zendesk ticket oluşturulamadı'));
      return;
    }
    if (result.ticketId) setZendeskIdDraft(result.ticketId);
    setPolicyMsg(`Zendesk ticket #${result.ticketId} oluşturuldu`);
    void refreshCaseDetail();
  };

  const syncCaseZendeskStatus = async () => {
    if (!selectedCaseId) return;
    setZendeskSyncing(true);
    const result = await syncPlatformSupportCaseZendeskStatus(selectedCaseId);
    setZendeskSyncing(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Durum senkronu başarısız'));
      return;
    }
    setPolicyMsg(`Zendesk durumu güncellendi (${result.zendeskStatus ?? '—'})`);
    void refreshCaseDetail();
  };

  const openMacroEditor = async () => {
    const res = await fetchPlatformSupportMacros();
    if (!res.ok || !res.macros?.length) {
      setMacroDraft(caseDetail?.macros?.length ? [...caseDetail.macros] : []);
    } else {
      setMacroDraft(res.macros.map((m) => ({ ...m })));
    }
    setMacroEditorOpen(true);
  };

  const saveCaseNotes = async () => {
    if (!selectedCaseId) return;
    setCaseNotesSaving(true);
    const result = await updatePlatformSupportCase(selectedCaseId, { notes: caseNotesDraft });
    setCaseNotesSaving(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Notlar kaydedilemedi'));
      return;
    }
    setPolicyMsg('İç notlar kaydedildi');
    void refreshCaseDetail();
  };

  const openCaseFromInbox = async () => {
    if (!selectedMail) return;
    const rootId = selectedMail.threadRootId || selectedMail.id;
    setInboxCaseCreating(true);
    const result = await createPlatformSupportCaseFromInbox(rootId);
    setInboxCaseCreating(false);
    if (!result.ok || !result.case) {
      setPolicyMsg(userMessage(result.error, 'Talep oluşturulamadı'));
      return;
    }
    setPolicyMsg(
      result.duplicate
        ? `Mevcut kayıt #${result.case.number} bağlandı`
        : `Kayıt #${result.case.number} oluşturuldu`,
    );
    setSection('cases');
    setSelectedCaseId(result.case.id);
    void load();
  };

  const saveCaseMeta = async () => {
    if (!selectedCaseId) return;
    setCaseMetaSaving(true);
    const tags = caseMetaDraft.tags
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await updatePlatformSupportCase(selectedCaseId, {
      status: caseMetaDraft.status as PlatformSupportCase['status'],
      priority: caseMetaDraft.priority,
      kind: caseMetaDraft.kind as PlatformSupportCase['kind'],
      assignee: caseMetaDraft.assignee.trim() || null,
      tags,
    });
    setCaseMetaSaving(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Kayıt güncellenemedi'));
      return;
    }
    let msg = 'Kayıt alanları güncellendi';
    if (result.zendeskSync?.ok) {
      msg += ` · Zendesk: ${result.zendeskSync.zendeskStatus ?? 'senkron'}`;
    } else if (result.zendeskSync && !result.zendeskSync.ok) {
      msg += ` · Zendesk senkron atlandı: ${result.zendeskSync.error ?? 'hata'}`;
    }
    setPolicyMsg(msg);
    void refreshCaseDetail();
  };

  const saveMacroEditor = async () => {
    setMacroSaving(true);
    const result = await savePlatformSupportMacros(macroDraft);
    setMacroSaving(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Makrolar kaydedilemedi'));
      return;
    }
    setPolicyMsg('Makro şablonları kaydedildi');
    setMacroEditorOpen(false);
    if (selectedCaseId) void refreshCaseDetail();
  };

  const onExport = async () => {
    setExporting(true);
    const result = await downloadPlatformSupportCsv(windowDays);
    setExporting(false);
    if (!result.ok) setPolicyMsg(userMessage(result.error, 'CSV indirilemedi'));
  };

  const onExportCaseActivity = async (format: 'csv' | 'html') => {
    if (!selectedCaseId) return;
    setActivityExporting(format);
    const exportFilter = activityFilter === 'all' ? 'all' : activityFilter;
    const result =
      format === 'csv'
        ? await downloadPlatformSupportCaseActivityCsv(selectedCaseId, exportFilter)
        : await openPlatformSupportCaseActivityPrint(selectedCaseId, exportFilter);
    setActivityExporting(null);
    if (!result.ok) setPolicyMsg(userMessage(result.error, 'Aktivite dışa aktarılamadı'));
  };

  if (loading && !data) return <SupportSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-support platform-support--premium platform-panel platform-panel--premium">
        <p className="platform-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!data) return null;

  const compliancePct = data.totals.compliancePercent ?? 0;
  const complianceVariant = compliancePct >= 85 ? 'brand' : compliancePct >= 60 ? 'warn' : 'muted';

  return (
    <div className="platform-support platform-support--premium platform-users--premium">
      <header className="platform-support-compact-hero" aria-label="Destek komuta merkezi">
        <div className="platform-support-compact-hero-primary">
          <div className="platform-support-compact-hero-title-row">
            <h2>Destek komuta merkezi</h2>
            <span className="platform-support-compact-hero-mail" title="Destek posta kutusu">
              {mailboxAddress ?? 'destek@ekolojikmarket.com.tr'}
            </span>
          </div>
          <p className="platform-support-compact-hero-meta">
            <time dateTime={data.generatedAt}>Güncelleme {formatDateTime(data.generatedAt)}</time>
            <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
            <span className={data.totals.queueSize > 0 ? 'is-warn' : ''}>{data.totals.queueSize} kuyruk</span>
            <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
            <span className={(data.cases?.open ?? 0) > 0 ? 'is-warn' : ''}>{data.cases?.open ?? 0} talep</span>
            <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
            <span className={inboxUnread > 0 ? 'is-warn' : ''}>{inboxUnread} mail</span>
          </p>
        </div>
        <div className="platform-support-compact-hero-toolbar">
          <div className="platform-support-compact-hero-sla" title={`SLA uyumu (${windowDays} gün)`}>
            <RingProgress pct={compliancePct} size={46} label="SLA" variant={complianceVariant} />
            <span className="platform-support-compact-hero-sla-label">SLA</span>
          </div>
          <label className="platform-support-compact-window">
            <span className="visually-hidden">Metrik penceresi</span>
            <select
              className="platform-support-compact-window-select"
              value={String(windowDays)}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              aria-label="Metrik penceresi"
            >
              <option value="7">7g</option>
              <option value="14">14g</option>
              <option value="30">30g</option>
              <option value="90">90g</option>
            </select>
          </label>
          <button
            type="button"
            className="platform-support-compact-icon-btn"
            onClick={() => void load()}
            disabled={loading}
            title="Yenile"
          >
            Yenile
          </button>
          <button
            type="button"
            className="platform-support-compact-icon-btn platform-support-compact-icon-btn--solid"
            onClick={() => void onExport()}
            disabled={exporting}
            title="CSV indir"
          >
            CSV
          </button>
          <div className="platform-support-header-command">
            <input
              className="platform-support-header-command-input"
              value={headerCommandLine}
              onChange={(e) => setHeaderCommandLine(e.target.value)}
              placeholder={contextTenantId ? `/requeue_outbox` : 'Komut (kiracı seçin)'}
              list="platform-support-header-commands"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runHeaderCommand();
              }}
              title="Kiracı 360 ile aynı komutlar; seçili kiracı veya satırda tenantId"
            />
            <datalist id="platform-support-header-commands">
              {commandHelp.map((c) => (
                <option key={c.id} value={`/${c.id}`}>{c.label}</option>
              ))}
            </datalist>
            <button
              type="button"
              className="platform-support-compact-icon-btn"
              disabled={!headerCommandLine.trim()}
              onClick={() => void runHeaderCommand()}
              title="Komutu çalıştır"
            >
              Komut
            </button>
          </div>
        </div>
      </header>

      <nav className="platform-support-subnav platform-support-subnav--premium" aria-label="Destek görünümü">
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'inbox' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('inbox')}
        >
          Gelen kutusu
          {inboxUnread > 0 ? <span className="platform-support-subnav-count">{inboxUnread}</span> : null}
        </button>
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'cases' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('cases')}
        >
          Talepler & sorunlar
          {(data.cases?.open ?? 0) > 0 ? (
            <span className="platform-support-subnav-count">{data.cases?.open}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'queue' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('queue')}
        >
          Mesaj kuyruğu & SLA
        </button>
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'sla' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('sla')}
        >
          SLA canlı
        </button>
      </nav>

      {policyMsg ? (
        <p className="platform-support-toast" role="status">
          {policyMsg}
        </p>
      ) : null}

      {section === 'cases' ? (
        <div className="platform-support-command-layout">
        <div className="platform-support-inbox-layout platform-support-command-main">
          {contactQueue.some((c) => !c.hasCase) ? (
            <section className="platform-panel platform-panel--premium platform-support-contact-queue">
              <h3>İletişim formu kuyruğu</h3>
              <p className="platform-support-hint">
                Yeni formlar otomatik talep oluşturur; eski kayıtlar için &quot;Talep&quot; kullanın.
              </p>
              <ul className="platform-support-inbox-items">
                {contactQueue
                  .filter((c) => !c.hasCase)
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.id}>
                      <button type="button" className="platform-support-inbox-item" onClick={() => void openCaseFromContact(c.id)}>
                        <span className="platform-support-inbox-item-subject">{c.subject}</span>
                        <span className="platform-support-inbox-item-from">{c.name} · {c.email}</span>
                        <span className="platform-support-inbox-item-date">{formatDateTime(c.createdAt)}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          <section className="platform-panel platform-panel--premium">
            <h3>Operasyon kayıtları (Case)</h3>
            <p className="platform-support-hint">
              E-posta senkronunda otomatik talep; Zendesk webhook ve API köprüsü (env). Dosya:{' '}
              <code>data/platform/support-cases.json</code>
            </p>
            <div className="platform-support-case-toolbar">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setManualCaseOpen((v) => !v)}
              >
                {manualCaseOpen ? 'Manuel kayıt iptal' : 'Manuel kayıt'}
              </button>
            </div>
            {manualCaseOpen ? (
              <div className="platform-support-manual-case">
                <h4>Manuel operasyon kaydı</h4>
                <label className="platform-support-field">
                  <span className="platform-support-field-label">Konu</span>
                  <input
                    className="platform-support-control"
                    value={manualCaseDraft.subject}
                    onChange={(e) => setManualCaseDraft((d) => ({ ...d, subject: e.target.value }))}
                  />
                </label>
                <div className="platform-support-policy-form">
                  <PlatformFilterSelect
                    label="Tür"
                    icon="role"
                    value={manualCaseDraft.kind}
                    onChange={(v) => setManualCaseDraft((d) => ({ ...d, kind: v }))}
                  >
                    <option value="request">Talep</option>
                    <option value="incident">Sorun</option>
                    <option value="system">Sistem</option>
                  </PlatformFilterSelect>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Kiracı ID</span>
                    <input
                      className="platform-support-control"
                      value={manualCaseDraft.tenantId}
                      onChange={(e) => setManualCaseDraft((d) => ({ ...d, tenantId: e.target.value }))}
                      placeholder={contextTenantId ?? 'opsiyonel'}
                    />
                  </label>
                </div>
                <div className="platform-support-policy-form">
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Talep eden ad</span>
                    <input
                      className="platform-support-control"
                      value={manualCaseDraft.requesterName}
                      onChange={(e) => setManualCaseDraft((d) => ({ ...d, requesterName: e.target.value }))}
                    />
                  </label>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">E-posta</span>
                    <input
                      className="platform-support-control"
                      value={manualCaseDraft.requesterEmail}
                      onChange={(e) => setManualCaseDraft((d) => ({ ...d, requesterEmail: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="platform-support-field">
                  <span className="platform-support-field-label">Not</span>
                  <textarea
                    className="platform-support-control"
                    rows={2}
                    value={manualCaseDraft.notes}
                    onChange={(e) => setManualCaseDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={manualCaseSaving}
                  onClick={() => void submitManualCase()}
                >
                  {manualCaseSaving ? 'Oluşturuluyor…' : 'Kayıt oluştur'}
                </button>
              </div>
            ) : null}
            <div className="platform-support-case-filters">
              <PlatformFilterSelect
                label="Durum"
                icon="role"
                value={caseListStatus}
                onChange={(v) => setCaseListStatus(v)}
              >
                <option value="all">Tümü</option>
                <option value="new">Yeni</option>
                <option value="open">Açık</option>
                <option value="pending">Beklemede</option>
                <option value="solved">Çözüldü</option>
                <option value="closed">Kapalı</option>
              </PlatformFilterSelect>
              <PlatformFilterSelect
                label="Tür"
                icon="role"
                value={caseListKind}
                onChange={(v) => setCaseListKind(v)}
              >
                <option value="all">Tümü</option>
                <option value="request">Talep</option>
                <option value="incident">Sorun</option>
                <option value="system">Sistem</option>
              </PlatformFilterSelect>
            </div>
            <table className="platform-table platform-table--scroll">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tür</th>
                  <th>Durum</th>
                  <th>Konu</th>
                  <th>Kiracı</th>
                  <th>Zendesk</th>
                </tr>
              </thead>
              <tbody>
                {caseRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Henüz kayıt yok</td>
                  </tr>
                ) : (
                  caseRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button type="button" className="btn btn-text" onClick={() => {
                          setSelectedCaseId(c.id);
                          setZendeskIdDraft(c.externalTicketRef?.id ?? '');
                        }}>
                          {c.number}
                        </button>
                      </td>
                      <td>{c.kind}</td>
                      <td>{c.status}</td>
                      <td>{c.subject}</td>
                      <td>
                        {c.tenantId ? (
                          <button
                            type="button"
                            className="btn btn-text"
                            onClick={() => setContextTenantId(c.tenantId!)}
                          >
                            {c.businessName ?? c.tenantId}
                          </button>
                        ) : (
                          c.businessName ?? '—'
                        )}
                      </td>
                      <td>
                        {c.externalTicketRef?.url ? (
                          <a href={c.externalTicketRef.url} target="_blank" rel="noopener noreferrer">
                            #{c.externalTicketRef.id}
                          </a>
                        ) : (
                          c.externalTicketRef?.id ?? '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
          <section className="platform-panel platform-panel--premium">
            {selectedCase ? (
              <>
                <h3>#{selectedCase.number} — {selectedCase.subject}</h3>
                <p className="platform-table-muted">
                  {selectedCase.channel} · {selectedCase.requesterEmail ?? selectedCase.requesterName ?? '—'}
                </p>
                <div className="platform-support-policy-form platform-support-case-meta">
                  <PlatformFilterSelect
                    label="Durum"
                    icon="role"
                    value={caseMetaDraft.status}
                    onChange={(v) => setCaseMetaDraft((d) => ({ ...d, status: v }))}
                  >
                    <option value="new">Yeni</option>
                    <option value="open">Açık</option>
                    <option value="pending">Beklemede</option>
                    <option value="solved">Çözüldü</option>
                    <option value="closed">Kapalı</option>
                  </PlatformFilterSelect>
                  <PlatformFilterSelect
                    label="Öncelik"
                    icon="role"
                    value={caseMetaDraft.priority}
                    onChange={(v) => setCaseMetaDraft((d) => ({ ...d, priority: v }))}
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </PlatformFilterSelect>
                  <PlatformFilterSelect
                    label="Tür"
                    icon="role"
                    value={caseMetaDraft.kind}
                    onChange={(v) => setCaseMetaDraft((d) => ({ ...d, kind: v }))}
                  >
                    <option value="request">Talep</option>
                    <option value="incident">Sorun</option>
                    <option value="system">Sistem</option>
                  </PlatformFilterSelect>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Atanan</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.assignee}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, assignee: e.target.value }))}
                      placeholder="operatör kullanıcı adı"
                    />
                  </label>
                  <label className="platform-support-field platform-support-field--wide">
                    <span className="platform-support-field-label">Etiketler</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.tags}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, tags: e.target.value }))}
                      placeholder="messaging, vip (virgülle)"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={caseMetaSaving}
                    onClick={() => void saveCaseMeta()}
                  >
                    {caseMetaSaving ? 'Kaydediliyor…' : 'Kaydı güncelle'}
                  </button>
                </div>
                {caseUnifiedTimeline.length > 0 ? (
                  <div className="platform-support-case-email-chain platform-support-unified-timeline">
                    <h4>Zaman çizelgesi</h4>
                    {caseDetail?.emailPreview?.plusAddress ? (
                      <p className="platform-support-hint">
                        Plus adres: <code>{caseDetail.emailPreview.plusAddress}</code>
                      </p>
                    ) : null}
                    <ul className="platform-support-case-email-list platform-support-case-email-list--timeline">
                      {caseUnifiedTimeline.map((entry) => (
                        <CaseTimelineItem key={entry.key} entry={entry} />
                      ))}
                    </ul>
                  </div>
                ) : caseDetail?.inboxSnippet ? (
                  <p className="platform-support-hint">Gelen mail: {caseDetail.inboxSnippet.subject}</p>
                ) : null}
                <div className="platform-support-360-actions">
                  <button type="button" className="btn btn-secondary" disabled={aiBusy} onClick={() => void runCaseAi('summary')}>
                    {aiBusy ? '…' : 'AI özet'}
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={aiBusy} onClick={() => void runCaseAi('draft_reply')}>
                    AI taslak
                  </button>
                  {actionDraft.trim() ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={aiBusy || !caseDetail?.aiCapabilities?.externalEnabled}
                      title={
                        caseDetail?.aiCapabilities?.externalEnabled
                          ? 'Harici AI ile düzenle'
                          : 'EKOLOJIK_POSTA_AI=1 gerekir'
                      }
                      onClick={() => void runCaseAi('refine_draft')}
                    >
                      Taslağı düzenle
                    </button>
                  ) : null}
                </div>
                {caseDetail?.aiCapabilities ? (
                  <p className="platform-support-hint platform-support-ai-hint">
                    AI:{' '}
                    {caseDetail.aiCapabilities.externalEnabled
                      ? `harici (${caseDetail.aiCapabilities.model})`
                      : 'yerel şablon (EKOLOJIK_POSTA_AI=1 + URL/key)'}
                  </p>
                ) : null}
                {aiSummary ? (
                  <pre className="platform-support-ai-summary">{aiSummary}</pre>
                ) : null}
                <div className="platform-support-policy-form">
                  <PlatformFilterSelect
                    label="Yanıt kanalı"
                    icon="role"
                    value={replyChannel}
                    onChange={(v) => setReplyChannel(v as typeof replyChannel)}
                  >
                    <option value="email">E-posta (destek@)</option>
                    <option value="messaging">Mesajlaşma</option>
                    <option value="note">İç not</option>
                  </PlatformFilterSelect>
                  {caseDetail?.macros?.length ? (
                    <label className="platform-support-field">
                      <span className="platform-support-field-label">Makro şablon</span>
                      <select
                        className="platform-support-control"
                        value={macroPick}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMacroPick(v);
                          if (v) void runCaseAi('apply_macro', { macroId: v });
                        }}
                      >
                        <option value="">Şablon seç…</option>
                        {caseDetail.macros.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {macroPick && caseDetail?.macros?.length ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={aiBusy || !caseDetail.aiCapabilities?.externalEnabled}
                      onClick={() => void runCaseAi('personalize_macro', { macroId: macroPick })}
                    >
                      Makro + AI
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void openMacroEditor()}>
                    Makroları düzenle
                  </button>
                </div>
                {macroEditorOpen ? (
                  <div className="platform-support-macro-editor">
                    <h4>Makro şablonları</h4>
                    <p className="platform-support-hint">
                      Değişkenler: <code>{'{{requesterFirstName}}'}</code>, <code>{'{{subject}}'}</code>,{' '}
                      <code>{'{{caseNumber}}'}</code> — dosya: <code>data/platform/support-macros.json</code>
                    </p>
                    {macroDraft.map((m, idx) => (
                      <div key={`${m.id}-${idx}`} className="platform-support-macro-editor-row">
                        <input
                          className="platform-support-control"
                          value={m.id}
                          placeholder="id"
                          onChange={(e) => {
                            const next = [...macroDraft];
                            next[idx] = { ...next[idx], id: e.target.value };
                            setMacroDraft(next);
                          }}
                        />
                        <input
                          className="platform-support-control"
                          value={m.label}
                          placeholder="Etiket"
                          onChange={(e) => {
                            const next = [...macroDraft];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setMacroDraft(next);
                          }}
                        />
                        <textarea
                          className="platform-support-control"
                          rows={3}
                          value={m.body}
                          onChange={(e) => {
                            const next = [...macroDraft];
                            next[idx] = { ...next[idx], body: e.target.value };
                            setMacroDraft(next);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setMacroDraft(macroDraft.filter((_, i) => i !== idx))}
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                    <div className="platform-support-macro-editor-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setMacroDraft([
                            ...macroDraft,
                            { id: `macro_${macroDraft.length + 1}`, label: 'Yeni şablon', body: '' },
                          ])
                        }
                      >
                        Şablon ekle
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={macroSaving}
                        onClick={() => void saveMacroEditor()}
                      >
                        {macroSaving ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setMacroEditorOpen(false)}>
                        Kapat
                      </button>
                    </div>
                  </div>
                ) : null}
                <label className="platform-support-reply-label">
                  {replyChannel === 'note' ? 'İç not' : 'Yanıt metni'}
                  <textarea rows={5} value={actionDraft} onChange={(e) => setActionDraft(e.target.value)} />
                </label>
                <button type="button" className="btn btn-primary" onClick={() => void sendCaseAction()} disabled={!actionDraft.trim()}>
                  Gönder
                </button>
                <div className="platform-support-zendesk-row">
                  <label className="platform-support-reply-label">
                    Zendesk ticket ID
                    <input
                      value={zendeskIdDraft}
                      onChange={(e) => setZendeskIdDraft(e.target.value)}
                      placeholder="örn. 12345"
                    />
                  </label>
                  <button type="button" className="btn btn-secondary" onClick={() => void saveCaseZendesk()}>
                    Zendesk kaydet
                  </button>
                  {selectedCase.externalTicketRef?.url ? (
                    <a
                      className="btn btn-outline btn-sm"
                      href={selectedCase.externalTicketRef.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Zendesk&apos;te aç
                    </a>
                  ) : null}
                  {zendeskApiReady && !selectedCase.externalTicketRef?.id ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={zendeskCreating}
                      onClick={() => void createCaseZendeskTicket()}
                    >
                      {zendeskCreating ? 'Oluşturuluyor…' : 'Zendesk ticket oluştur'}
                    </button>
                  ) : null}
                  {zendeskApiReady && (selectedCase.externalTicketRef?.id || zendeskIdDraft.trim()) ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={zendeskPushing}
                        onClick={() => void pushCaseToZendesk()}
                      >
                        {zendeskPushing ? 'Gönderiliyor…' : 'Özeti Zendesk’e gönder'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={zendeskSyncing}
                        onClick={() => void syncCaseZendeskStatus()}
                        title="Platform kayıt durumunu Zendesk ticket’a yaz"
                      >
                        {zendeskSyncing ? 'Senkron…' : 'Durumu Zendesk’e yaz'}
                      </button>
                    </>
                  ) : null}
                </div>
                {zendeskApiReady ? (
                  <p className="platform-support-hint platform-support-zendesk-hint">
                    Webhook, <code>platform_case_N</code> etiketi veya kayıtlı ticket ID ile kayda bağlanır; platform
                    durumu değişince otomatik Zendesk senkronu dener.
                  </p>
                ) : null}
                {caseDetail ? (
                  <div className="platform-support-case-activity">
                    <div className="platform-support-activity-head">
                      <h4>Aktivite</h4>
                      <div className="platform-support-activity-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={activityExporting !== null}
                          onClick={() => void onExportCaseActivity('csv')}
                          title={
                            activityFilter === 'all'
                              ? 'Tüm aktiviteler'
                              : `Seçili filtre: ${activityFilterLabel(activityFilter)}`
                          }
                        >
                          {activityExporting === 'csv' ? 'İndiriliyor…' : 'CSV'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={activityExporting !== null}
                          onClick={() => void onExportCaseActivity('html')}
                          title="Yazdır veya PDF olarak kaydet"
                        >
                          {activityExporting === 'html' ? 'Açılıyor…' : 'PDF / yazdır'}
                        </button>
                        {caseDetail.case.activity?.length ? (
                          <PlatformFilterSelect
                            label="Filtre"
                            icon="role"
                            value={activityFilter}
                            onChange={(v) => setActivityFilter(v as PlatformSupportActivityFilter)}
                          >
                            <option value="all">Tümü</option>
                            <option value="email_inbound">Gelen e-posta</option>
                            <option value="email_outbound">Giden e-posta</option>
                            <option value="note">İç not</option>
                            <option value="zendesk">Zendesk</option>
                            <option value="case_meta">Kayıt / politika</option>
                            <option value="messaging">Mesajlaşma</option>
                          </PlatformFilterSelect>
                        ) : null}
                      </div>
                    </div>
                    {caseDetail.case.activity?.length ? (
                      <ul>
                        {filteredCaseActivity.length === 0 ? (
                          <li className="platform-support-hint">Bu filtrede kayıt yok.</li>
                        ) : (
                          <>
                            {visibleCaseActivity.map((a) => (
                              <li key={a.id} className={`platform-support-activity-item platform-support-activity-item--${a.type}`}>
                                <span className="platform-table-muted">
                                  {formatDateTime(a.createdAt)} · {activityTypeLabel(a.type)} · {a.createdBy}
                                </span>
                                <p className="platform-support-activity-body">{a.body}</p>
                                {a.html ? (
                                  <details className="platform-support-email-html-details">
                                    <summary>HTML önizleme</summary>
                                    <SupportEmailHtmlFrame html={a.html} title={`Aktivite ${a.id}`} />
                                  </details>
                                ) : null}
                              </li>
                            ))}
                            {filteredCaseActivity.length > ACTIVITY_LIST_CAP && !showAllActivity ? (
                              <li>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setShowAllActivity(true)}
                                >
                                  Tümünü göster ({filteredCaseActivity.length})
                                </button>
                              </li>
                            ) : null}
                            {showAllActivity && filteredCaseActivity.length > ACTIVITY_LIST_CAP ? (
                              <li>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setShowAllActivity(false)}
                                >
                                  Listeyi kısalt
                                </button>
                              </li>
                            ) : null}
                          </>
                        )}
                      </ul>
                    ) : (
                      <p className="platform-support-hint">Henüz aktivite yok; dışa aktarma boş bir tablo üretir.</p>
                    )}
                  </div>
                ) : (
                  <p className="platform-support-hint">Aktivite yükleniyor…</p>
                )}
                <label className="platform-support-reply-label platform-support-case-notes">
                  <span>Operasyon notları (iç)</span>
                  <textarea
                    rows={4}
                    value={caseNotesDraft}
                    onChange={(e) => setCaseNotesDraft(e.target.value)}
                    placeholder="Ekip içi özet, müşteriye gitmez"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={caseNotesSaving}
                    onClick={() => void saveCaseNotes()}
                  >
                    {caseNotesSaving ? 'Kaydediliyor…' : 'Notları kaydet'}
                  </button>
                </label>
              </>
            ) : (
              <p className="platform-support-hint">Soldan bir kayıt seçin.</p>
            )}
          </section>
        </div>
        <PlatformSupportTenant360 tenantId={contextTenantId} onMessage={setPolicyMsg} />
        </div>
      ) : null}

      {section === 'sla' ? (
        <PlatformSupportSlaLive
          windowDays={windowDays}
          onOpenCase={(caseId) => {
            setSection('cases');
            setSelectedCaseId(caseId);
          }}
          onFocusQueueTenant={(tenantId) => {
            setContextTenantId(tenantId);
            setSection('queue');
          }}
        />
      ) : null}

      {section === 'inbox' ? (
        <div className="platform-support-inbox-layout">
          <section className="platform-panel platform-panel--premium platform-support-inbox-list">
            <div className="platform-panel-head">
              <h3>destek@ gelen</h3>
              <button type="button" className="btn btn-secondary" onClick={() => void onInboxSync()} disabled={inboxSyncing}>
                {inboxSyncing ? 'Senkron…' : mailboxConfigured ? 'IMAP + outbox' : 'Güncelle'}
              </button>
            </div>
            <div className="platform-support-inbox-filters">
              <PlatformFilterSelect
                label="Filtre"
                icon="role"
                value={inboxFilter}
                onChange={(v) => setInboxFilter(v as typeof inboxFilter)}
              >
                <option value="all">Tümü</option>
                <option value="unread">Okunmamış</option>
                <option value="attachments">Ekli</option>
              </PlatformFilterSelect>
              <label className="platform-support-field platform-support-inbox-search">
                <span className="visually-hidden">Ara</span>
                <input
                  className="platform-support-control"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Konu, gönderen, metin…"
                />
              </label>
            </div>
            {!mailboxConfigured ? (
              <p className="platform-support-hint">
                Mağaza <strong>Posta</strong> üzerinden <code>destek@ekolojikmarket.com.tr</code> adresine yazılanlar burada listelenir
                (outbox köprüsü). Gönderim <strong>PENDING</strong> ise SMTP henüz çıkmamış olabilir; yine de gelen kutusunda görünür.
                Harici posta ve IMAP için VPS’te <code>EKOLOJIK_SUPPORT_IMAP_*</code> —{' '}
                <code>scripts/sunucu-ekolojik-destek-mailbox.sh</code>
              </p>
            ) : (
              <p className="platform-support-hint platform-table-muted">
                IMAP ile dış mail + mağaza outbox birlikte senkronlanır.
              </p>
            )}
            <ul className="platform-support-inbox-items">
              {inboxMessages.length === 0 ? (
                <li className="platform-support-inbox-empty">
                  Henüz kayıt yok — yöneticiden destek@ gönderin veya Güncelle’ye basın.
                </li>
              ) : filteredInboxThreads.length === 0 ? (
                <li className="platform-support-inbox-empty">Filtreye uyan mail yok.</li>
              ) : (
                filteredInboxThreads.map(({ head, count, key }) => (
                  <li key={key}>
                    <button
                      type="button"
                      className={`platform-support-inbox-item ${inboxThreadKey(selectedMail ?? head) === key ? 'is-selected' : ''} ${!head.readAt ? 'is-unread' : ''}`}
                      onClick={() => setSelectedMailId(head.id)}
                    >
                      <span className="platform-support-inbox-item-subject">
                        {head.subject || '(konu yok)'}
                        {count > 1 ? <span className="platform-support-thread-count">{count} mesaj</span> : null}
                        {(head.attachments?.length ?? 0) > 0 ? (
                          <span className="platform-support-inbox-attach-badge">Ek {head.attachments!.length}</span>
                        ) : null}
                      </span>
                      <span className="platform-support-inbox-item-from">{head.from}</span>
                      {'outboxStatus' in head && head.outboxStatus && head.outboxStatus !== 'sent' ? (
                        <span className="platform-support-inbox-item-status">{String(head.outboxStatus).toUpperCase()}</span>
                      ) : null}
                      <span className="platform-support-inbox-item-date">{formatDateTime(head.receivedAt)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="platform-panel platform-panel--premium platform-support-inbox-detail">
            {selectedMail ? (
              <>
                <h3>{selectedMail.subject}</h3>
                <p className="platform-table-muted">{selectedMail.from}</p>
                <dl className="platform-support-mail-meta">
                  <div>
                    <dt>Talep referansı</dt>
                    <dd>
                      <code>{selectedMail.id}</code>
                      <span className="platform-support-hint"> Müşteriye otomatik yanıtta gösterilen kod.</span>
                    </dd>
                  </div>
                  {selectedMail.threadRootId && selectedMail.threadRootId !== selectedMail.id ? (
                    <div>
                      <dt>Thread kökü</dt>
                      <dd>
                        <code>{selectedMail.threadRootId}</code>
                        <span className="platform-support-hint"> Bu mail mevcut konuşmanın devamı.</span>
                      </dd>
                    </div>
                  ) : null}
                  {selectedMailCase ? (
                    <div>
                      <dt>Destek kaydı</dt>
                      <dd>
                        #{selectedMailCase.number}
                        <button
                          type="button"
                          className="platform-support-inline-link"
                          onClick={() => {
                            setSection('cases');
                            setSelectedCaseId(selectedMailCase.id);
                          }}
                        >
                          Kaydı aç
                        </button>
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Destek kaydı</dt>
                      <dd>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={inboxCaseCreating}
                          onClick={() => void openCaseFromInbox()}
                        >
                          {inboxCaseCreating ? 'Oluşturuluyor…' : 'Talep oluştur'}
                        </button>
                        <span className="platform-support-hint"> Thread kökü ile e-posta zinciri bağlanır.</span>
                      </dd>
                    </div>
                  )}
                  {selectedMail.messageId ? (
                    <div>
                      <dt>E-posta Message-ID</dt>
                      <dd><code className="platform-support-mono-truncate">{selectedMail.messageId}</code></dd>
                    </div>
                  ) : null}
                  {selectedMail.inReplyTo ? (
                    <div>
                      <dt>In-Reply-To</dt>
                      <dd><code className="platform-support-mono-truncate">{selectedMail.inReplyTo}</code></dd>
                    </div>
                  ) : null}
                </dl>
                {selectedMail.autoreplySentAt ? (
                  <p className="platform-inline-msg">Otomatik alındı maili gönderildi ({formatDateTime(selectedMail.autoreplySentAt)})</p>
                ) : null}
                {selectedThreadMessages.length > 1 ? (
                  <div className="platform-support-thread-timeline">
                    <h4 className="platform-support-thread-title">Konuşma ({selectedThreadMessages.length})</h4>
                    {selectedThreadMessages.map((msg) => (
                      <article
                        key={msg.id}
                        className={`platform-support-thread-msg ${msg.id === selectedMail.id ? 'is-focused' : ''}`}
                      >
                        <header>
                          <span>{formatDateTime(msg.receivedAt)}</span>
                          <code>{msg.id}</code>
                        </header>
                        <p>{msg.bodyText || msg.snippet}</p>
                        <SupportInboxAttachments messageId={msg.id} attachments={msg.attachments ?? []} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="platform-support-inbox-body">
                    {selectedMail.bodyText || selectedMail.snippet}
                    <SupportInboxAttachments messageId={selectedMail.id} attachments={selectedMail.attachments ?? []} />
                  </div>
                )}
                <label className="platform-support-reply-label">
                  Yanıt (destek@)
                  <textarea rows={5} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
                </label>
                <button type="button" className="btn btn-primary" onClick={() => void onReply()} disabled={!replyDraft.trim()}>
                  Gönder
                </button>
              </>
            ) : (
              <p className="platform-support-hint">Listeden bir mail seçin.</p>
            )}
          </section>
        </div>
      ) : null}

      {section === 'queue' ? (
        <div className="platform-support-command-layout">
        <div className="platform-support-command-main">
      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi platform-users-kpi--accent">
          <KpiIcon name="users" />
          <span className="platform-users-kpi-label">Kuyruk</span>
          <strong className="platform-users-kpi-value">{data.totals.queueSize}</strong>
          <span className="platform-users-kpi-sub">{data.totals.pendingFirstResponse} ilk yanıt bekliyor</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <span className="platform-users-kpi-label">Açık / beklemede</span>
          <strong className="platform-users-kpi-value">
            {data.totals.openThreads} / {data.totals.waitingThreads}
          </strong>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <span className="platform-users-kpi-label">İlk yanıt (ort.)</span>
          <strong className="platform-users-kpi-value">{formatDurationMs(data.totals.firstResponse.avgMs)}</strong>
          <span className="platform-users-kpi-sub">
            Medyan {formatDurationMs(data.totals.firstResponse.medianMs)} · p90{' '}
            {formatDurationMs(data.totals.firstResponse.p90Ms)}
          </span>
        </article>
        <article className="platform-users-kpi platform-support-kpi-ring">
          <RingProgress pct={compliancePct} label="SLA uyumu" variant={complianceVariant} />
          <span className="platform-users-kpi-sub platform-support-kpi-ring-caption">
            Hedef: {data.policy.firstResponseTargetMinutes} dk
          </span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="churn" />
          <span className="platform-users-kpi-label">SLA ihlali (pencere)</span>
          <strong className="platform-users-kpi-value">{data.totals.slaBreaches}</strong>
          <span className="platform-users-kpi-sub">{data.totals.slaMet} süre içinde yanıt</span>
        </article>
      </div>

      <div className="platform-support-columns">
        <section className="platform-panel platform-panel--premium platform-support-policy">
          <h3>SLA eşikleri</h3>
          {policyDraft ? (
            <div className="platform-support-policy-form">
              <label>
                İlk yanıt hedefi (dakika)
                <input
                  type="number"
                  min={15}
                  max={10080}
                  value={policyDraft.firstResponseTargetMinutes}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      firstResponseTargetMinutes: Number(e.target.value) || 240,
                    })
                  }
                />
              </label>
              <label>
                Beklemede eskime (saat)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={policyDraft.staleWaitingHours}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      staleWaitingHours: Number(e.target.value) || 24,
                    })
                  }
                />
              </label>
              <label>
                Kapalı kayda gelen e-posta
                <select
                  className="platform-support-control"
                  value={policyDraft.closedCaseInbound ?? 'reopen'}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      closedCaseInbound: e.target.value as ClosedCaseInboundMode,
                    })
                  }
                >
                  <option value="reopen">Kaydı yeniden aç</option>
                  <option value="keep_closed">Kapalı kalsın (aktivite ekle)</option>
                  <option value="new_case">Yeni kayıt aç</option>
                </select>
              </label>
              {policyDraft.closedCaseInbound ? (
                <div className="platform-support-policy-preview" role="note">
                  <p className="platform-support-policy-preview-lead">
                    {CLOSED_CASE_INBOUND_PREVIEW[policyDraft.closedCaseInbound].summary}
                  </p>
                  <ul className="platform-support-policy-preview-list">
                    <li>
                      <strong>Müşteri:</strong>{' '}
                      {CLOSED_CASE_INBOUND_PREVIEW[policyDraft.closedCaseInbound].customer}
                    </li>
                    <li>
                      <strong>Operasyon:</strong>{' '}
                      {CLOSED_CASE_INBOUND_PREVIEW[policyDraft.closedCaseInbound].ops}
                    </li>
                  </ul>
                </div>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={() => void savePolicy()}>
                Kaydet
              </button>
            </div>
          ) : null}
          {policyMsg ? <p className="platform-inline-msg">{policyMsg}</p> : null}
        </section>

        <section className="platform-panel platform-panel--premium">
          <div className="platform-panel-head">
            <h3>Öncelikli kuyruk</h3>
            <PlatformFilterSelect
              label="Tür"
              icon="role"
              value={queueFilter}
              onChange={(v) => setQueueFilter(v as typeof queueFilter)}
            >
              <option value="all">Tümü</option>
              <option value="first_response">İlk yanıt</option>
              <option value="stale_waiting">Eski bekleme</option>
            </PlatformFilterSelect>
          </div>
          <table className="platform-table platform-table--scroll">
            <thead>
              <tr>
                <th>Önem</th>
                <th>Kiracı</th>
                <th>Müşteri / konu</th>
                <th>Bekleme</th>
                <th>Güncelleme</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6}>Kuyruk boş</td>
                </tr>
              ) : (
                filteredQueue.map((q) => {
                  const linkedCase = caseByMessagingThread.get(`${q.tenantId}:${q.threadId}`);
                  return (
                  <tr key={q.id} className={`platform-support-row platform-support-row--${q.severity}`}>
                    <td>
                      <span className={`platform-support-badge platform-support-badge--${q.severity}`}>
                        {SEV_LABELS[q.severity] ?? q.severity}
                      </span>
                      <span className="platform-table-muted">{KIND_LABELS[q.kind] ?? q.kind}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-text platform-table-primary"
                        onClick={() => setContextTenantId(q.tenantId)}
                      >
                        {q.businessName}
                      </button>
                      <span className="platform-table-muted">{q.tenantId}</span>
                    </td>
                    <td>
                      {q.customerName}
                      <span className="platform-table-muted">{q.subject}</span>
                    </td>
                    <td>{formatDurationMs(q.waitMs)}</td>
                    <td>{formatDateTime(q.updatedAt)}</td>
                    <td>
                      {linkedCase ? (
                        <button
                          type="button"
                          className="btn btn-text"
                          onClick={() => void openCaseFromQueue(q)}
                        >
                          #{linkedCase.number}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-text" onClick={() => void openCaseFromQueue(q)}>
                          Talep
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="platform-panel platform-panel--premium">
        <h3>Kiracı SLA özeti</h3>
        <table className="platform-table platform-table--scroll">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Açık</th>
              <th>Beklemede</th>
              <th>İlk yanıt bekliyor</th>
              <th>Medyan yanıt</th>
              <th>Kuyruk</th>
              <th>İhlal</th>
              <th>Onboarding</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.tenantId}>
                <td>
                  <span className="platform-table-primary">{t.businessName}</span>
                  <span className="platform-table-muted">{t.tenantId}</span>
                </td>
                <td>{t.messaging.open}</td>
                <td>{t.messaging.waiting}</td>
                <td>{t.messaging.pendingFirstResponse}</td>
                <td>{formatDurationMs(t.firstResponse.medianMs)}</td>
                <td>{t.queueItems}</td>
                <td>{t.slaBreaches}</td>
                <td>
                  {t.postaOnboardingComplete ? 'Tamam' : t.messagingEmbedReady ? 'Embed OK' : t.onboardingStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
        </div>
        <PlatformSupportTenant360 tenantId={contextTenantId} onMessage={setPolicyMsg} />
        </div>
      ) : null}
    </div>
  );
}
