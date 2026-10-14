import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveTenantId } from '../storage/tenantSession';
import { syncPosApiTokenToCurrentTenant } from '../services/posApiAuth';
import {
  createPlatformSupportCaseFromContact,
  createPlatformSupportCaseFromInbox,
  createPlatformSupportCaseFromQueue,
  createPlatformSupportCaseManual,
  fetchPlatformSupportCommands,
  downloadPlatformSupportCsv,
  downloadPlatformSupportContactQueueCsv,
  downloadPlatformSupportCaseActivityCsv,
  downloadPlatformSupportInboxAttachment,
  openPlatformSupportCaseActivityPrint,
  fetchPlatformSupportCaseDetail,
  fetchPlatformSupportMacros,
  savePlatformSupportMacros,
  fetchPlatformSupportCases,
  fetchPlatformSupportCaseTags,
  markPlatformSupportInboxRead,
  fetchPlatformSupportContactQueue,
  fetchPlatformSupportSmokeFilters,
  savePlatformSupportSmokeFilters,
  previewPlatformSupportSmokeFilters,
  fetchPlatformSupportSkills,
  savePlatformSupportSkills,
  type PlatformSupportSkillsHub,
  type PlatformSupportSmokePreview,
  fetchPlatformSupportInbox,
  fetchPlatformSupportOverview,
  fetchPlatformSupportZendeskBridge,
  fetchPlatformSupportMentionOperators,
  fetchPlatformSupportAssigneeOptions,
  fetchPlatformSupportMentionInbox,
  createPlatformSupportCaseZendesk,
  pushPlatformSupportCaseZendesk,
  syncPlatformSupportCaseZendeskStatus,
  fetchPlatformSupportCaseAi,
  postPlatformSupportCaseAction,
  postPlatformSupportSlaApologyBatch,
  postPlatformSupportCommand,
  replyPlatformSupportInbox,
  savePlatformSupportSlaPolicy,
  syncPlatformSupportInbox,
  updatePlatformSupportCase,
  type PlatformSupportCase,
  type PlatformSupportCaseDetail,
  type PlatformSupportSentReply,
  type PlatformSupportCommandHelp,
  type PlatformSupportContactQueueItem,
  type PlatformSupportSmokeFilters,
  type PlatformSupportInboxAttachment,
  type PlatformSupportInboxMessage,
  type PlatformSupportPayload,
  type ClosedCaseInboundMode,
  type PlatformSupportSlaPolicy,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';
import { PlatformSupportTenant360 } from './PlatformSupportTenant360';
import { PlatformSupportSlaLive } from './PlatformSupportSlaLive';
import { usePlatformNav } from './PlatformNavContext';
import { buildCaseUnifiedTimeline, type CaseTimelineEntry } from './platformSupportCaseTimeline';
import {
  filterCaseActivities,
  type PlatformSupportActivityFilter,
} from './platformSupportActivityFilter';

const KIND_LABELS: Record<string, string> = {
  first_response: 'İlk yanıt bekliyor',
  stale_waiting: 'Beklemede (eski)',
};

const CASE_STATUS_LABELS: Record<string, string> = {
  new: 'Yeni',
  open: 'Açık',
  pending: 'Beklemede',
  solved: 'Çözüldü',
  closed: 'Kapalı',
};

const CASE_KIND_LABELS: Record<string, string> = {
  request: 'Talep',
  incident: 'Sorun',
  system: 'Sistem',
};

type CaseListMailbox = 'active' | 'solved' | 'closed' | 'all';

function caseListStatusQuery(mailbox: CaseListMailbox, activeSubStatus: string): string {
  if (mailbox === 'solved') return 'solved';
  if (mailbox === 'closed') return 'closed';
  if (mailbox === 'all') return 'all';
  if (activeSubStatus === 'new' || activeSubStatus === 'open' || activeSubStatus === 'pending') {
    return activeSubStatus;
  }
  return 'active';
}

const CASE_MAILBOX_LABELS: Record<CaseListMailbox, string> = {
  active: 'Açık kutu',
  solved: 'Çözüldü',
  closed: 'Kapalı',
  all: 'Tümü',
};

function resolveCaseTenantId(c: PlatformSupportCase | null | undefined): string | null {
  if (!c) return null;
  const direct = c.tenantId ?? c.links?.tenantId ?? null;
  if (direct) return direct;
  if (c.channel === 'contact_form' || c.channel === 'email' || (c.tags ?? []).includes('destek-mail')) {
    return 'main';
  }
  return null;
}

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
  if (entry.kind === 'contact_form') {
    return (
      <li className="is-contact-form">
        <header>
          <span>İletişim formu · {entry.subject}</span>
          <span>{formatDateTime(entry.at)}</span>
        </header>
        <p className="platform-table-muted">
          {entry.name} · {entry.email}
        </p>
        <p className="platform-support-case-email-body">{entry.bodyText}</p>
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
  const platformNav = usePlatformNav();
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
  const [section, setSection] = useState<'inbox' | 'queue' | 'cases' | 'sla' | 'contact'>('cases');
  const [caseRows, setCaseRows] = useState<PlatformSupportCase[]>([]);
  /** Tüm kayıtlar (filtre dışı) — kuyruk ↔ mesaj thread bağlantısı */
  const [caseLinkRows, setCaseLinkRows] = useState<PlatformSupportCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseListMailbox, setCaseListMailbox] = useState<CaseListMailbox>('active');
  const [caseListActiveSub, setCaseListActiveSub] = useState<string>('active');
  const [caseListKind, setCaseListKind] = useState<string>('all');
  const [caseListTag, setCaseListTag] = useState<string>('all');
  const [caseTagOptions, setCaseTagOptions] = useState<string[]>([]);
  const [inboxMarkingRead, setInboxMarkingRead] = useState(false);
  const [caseMetaDraft, setCaseMetaDraft] = useState({
    status: 'open',
    priority: 'normal',
    kind: 'request',
    assignee: '',
    tags: '',
    tenantId: '',
    businessName: '',
  });
  const [inboxMailbox, setInboxMailbox] = useState<'inbound' | 'sent'>('inbound');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'attachments'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxSentMessages, setInboxSentMessages] = useState<PlatformSupportSentReply[]>([]);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
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
  const [contactFilter, setContactFilter] = useState<'all' | 'pending' | 'linked'>('pending');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactCaseSaving, setContactCaseSaving] = useState(false);
  const [contactExporting, setContactExporting] = useState(false);
  const [skillsHub, setSkillsHub] = useState<PlatformSupportSkillsHub | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [smokeFilterDraft, setSmokeFilterDraft] = useState<PlatformSupportSmokeFilters | null>(null);
  const [smokeFilterSaving, setSmokeFilterSaving] = useState(false);
  const [smokeFilterOpen, setSmokeFilterOpen] = useState(false);
  const [smokePreview, setSmokePreview] = useState<PlatformSupportSmokePreview | null>(null);
  const [smokePreviewLoading, setSmokePreviewLoading] = useState(false);
  const [slaApologyBusyId, setSlaApologyBusyId] = useState<string | null>(null);
  const [slaApologyBatchBusy, setSlaApologyBatchBusy] = useState(false);
  const [contextTenantId, setContextTenantId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [macroPick, setMacroPick] = useState('');
  const [macroEditorOpen, setMacroEditorOpen] = useState(false);
  const [macroDraft, setMacroDraft] = useState<Array<{ id: string; label: string; body: string }>>([]);
  const [macroSaving, setMacroSaving] = useState(false);
  const [mentionOperators, setMentionOperators] = useState<Array<{ username: string; displayName: string }>>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<Array<{ username: string; displayName: string }>>([]);
  const [mentionUnread, setMentionUnread] = useState(0);

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
    const inboxRes = await fetchPlatformSupportInbox('inbound');
    if (inboxRes.ok && inboxRes.data) {
      setInboxMessages(inboxRes.data.messages);
      setInboxUnread(inboxRes.data.unread);
      setMailboxConfigured(inboxRes.data.mailbox.configured);
      setMailboxAddress(inboxRes.data.mailbox.address);
    }
    const sentRes = await fetchPlatformSupportInbox('sent');
    if (sentRes.ok && sentRes.sent) {
      setInboxSentMessages(sentRes.sent);
    }
    setPolicyDraft({
      firstResponseTargetMinutes: result.data.policy.firstResponseTargetMinutes,
      staleWaitingHours: result.data.policy.staleWaitingHours,
      closedCaseInbound: result.data.policy.closedCaseInbound ?? 'reopen',
    });
    const casesRes = await fetchPlatformSupportCases(
      caseListStatusQuery(caseListMailbox, caseListActiveSub),
      caseListKind,
      caseListTag,
    );
    if (casesRes.ok && casesRes.data) {
      setCaseRows(casesRes.data.cases);
    }
    const linkCasesRes = await fetchPlatformSupportCases('all', 'all', 'all', 500);
    if (linkCasesRes.ok && linkCasesRes.data) {
      setCaseLinkRows(linkCasesRes.data.cases);
    }
    const tagsRes = await fetchPlatformSupportCaseTags();
    if (tagsRes.ok && tagsRes.tags) setCaseTagOptions(tagsRes.tags);
    const contactRes = await fetchPlatformSupportContactQueue(80);
    if (contactRes.ok && contactRes.data) {
      setContactQueue(contactRes.data.items);
    }
    const skillsRes = await fetchPlatformSupportSkills();
    if (skillsRes.ok && skillsRes.skills) {
      setSkillsHub({
        skills: skillsRes.skills,
        channelMap: skillsRes.channelMap ?? {},
        tagMap: skillsRes.tagMap ?? {},
      });
    }
    const smokeRes = await fetchPlatformSupportSmokeFilters();
    if (smokeRes.ok && smokeRes.filters) {
      setSmokeFilterDraft(smokeRes.filters);
    }
    const zendeskRes = await fetchPlatformSupportZendeskBridge();
    setZendeskApiReady(Boolean(zendeskRes.ok && zendeskRes.data?.apiConfigured));
    const cmdRes = await fetchPlatformSupportCommands();
    if (cmdRes.ok && cmdRes.commands?.length) setCommandHelp(cmdRes.commands);
    const mentionOps = await fetchPlatformSupportMentionOperators();
    if (mentionOps.ok && mentionOps.operators) {
      setMentionOperators(mentionOps.operators.map((o) => ({ username: o.username, displayName: o.displayName })));
    }
    const assignOps = await fetchPlatformSupportAssigneeOptions();
    if (assignOps.ok && assignOps.operators) setAssigneeOptions(assignOps.operators);
    const mentionInbox = await fetchPlatformSupportMentionInbox();
    if (mentionInbox.ok) setMentionUnread(mentionInbox.unread ?? 0);
    setLoading(false);
  }, [windowDays, caseListMailbox, caseListActiveSub, caseListKind, caseListTag]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectSupportCase = useCallback((c: PlatformSupportCase) => {
    setSelectedCaseId(c.id);
    setZendeskIdDraft(c.externalTicketRef?.id ?? '');
    const tid = resolveCaseTenantId(c);
    if (tid) setContextTenantId(tid);
  }, []);

  useEffect(() => {
    if (section !== 'cases') return;
    if (selectedCaseId && !caseRows.some((row) => row.id === selectedCaseId)) {
      setSelectedCaseId(null);
    }
  }, [section, selectedCaseId, caseRows]);

  useEffect(() => {
    const c = caseRows.find((row) => row.id === selectedCaseId);
    setContextTenantId(resolveCaseTenantId(c ?? null));
  }, [selectedCaseId, caseRows]);

  useEffect(() => {
    if (section !== 'cases' || selectedCaseId || caseRows.length === 0) return;
    selectSupportCase(caseRows[0]);
  }, [section, caseRows, selectedCaseId, selectSupportCase]);

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
      tenantId: selectedCase.tenantId ?? selectedCase.links?.tenantId ?? '',
      businessName: selectedCase.businessName ?? '',
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
    selectedCase?.tenantId,
    selectedCase?.businessName,
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
  const caseByInboxRoot = useMemo(() => {
    const map = new Map<string, PlatformSupportCase>();
    for (const c of caseLinkRows) {
      const rootId = c.links?.inboxMessageId;
      if (!rootId) continue;
      const prev = map.get(rootId);
      if (!prev || Date.parse(c.updatedAt) > Date.parse(prev.updatedAt)) {
        map.set(rootId, c);
      }
    }
    return map;
  }, [caseLinkRows]);

  const selectedMailCase =
    selectedMail && selectedMailThreadRootId
      ? caseByInboxRoot.get(selectedMailThreadRootId) ?? null
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

  const filteredInboxSent = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    return inboxSentMessages.filter((row) => {
      if (!q) return true;
      const blob = [row.subject, row.to, row.preview, row.kindLabel, String(row.caseNumber ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [inboxSentMessages, inboxSearch]);

  const selectedSent = inboxSentMessages.find((m) => m.id === selectedSentId) ?? null;

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
    const rank = (c: PlatformSupportCase) => {
      if (c.status !== 'closed' && c.status !== 'solved') return 2;
      return 1;
    };
    const sorted = [...caseLinkRows].sort((a, b) => {
      const dr = rank(b) - rank(a);
      if (dr !== 0) return dr;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
    for (const c of sorted) {
      const tenantId = c.links?.tenantId ?? c.tenantId;
      const threadId = c.links?.threadId;
      if (!tenantId || !threadId) continue;
      const key = `${tenantId}:${threadId}`;
      if (!map.has(key)) map.set(key, c);
    }
    return map;
  }, [caseLinkRows]);

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

  const openQueueMessaging = (q: PlatformSupportPayload['queue'][0]) => {
    saveTenantId(q.tenantId);
    syncPosApiTokenToCurrentTenant();
    const url = `/app?tenant=${encodeURIComponent(q.tenantId)}&view=posta&threadId=${encodeURIComponent(q.threadId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const markVisibleInboxRead = async () => {
    const ids = filteredInboxThreads.flatMap((t) =>
      t.messages.filter((m) => !m.readAt).map((m) => m.id),
    );
    if (!ids.length) return;
    setInboxMarkingRead(true);
    const result = await markPlatformSupportInboxRead(ids);
    setInboxMarkingRead(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Okundu işaretlenemedi'));
      return;
    }
    setPolicyMsg(`${result.marked ?? 0} mail okundu olarak işaretlendi`);
    void load();
  };

  const openLinkedCase = (c: PlatformSupportCase) => {
    selectSupportCase(c);
    setSection('cases');
    const closed = c.status === 'closed' || c.status === 'solved';
    setPolicyMsg(closed ? `Kayıt #${c.number} (${c.status})` : `Kayıt #${c.number}`);
  };

  const openCaseFromQueue = async (q: PlatformSupportPayload['queue'][0]) => {
    const existing = caseByMessagingThread.get(`${q.tenantId}:${q.threadId}`);
    if (existing) {
      openLinkedCase(existing);
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

  const contactWithoutCase = useMemo(
    () => data?.contactForm?.withoutCase ?? contactQueue.filter((c) => !c.hasCase).length,
    [contactQueue, data?.contactForm?.withoutCase],
  );

  const onExportContactQueue = async () => {
    setContactExporting(true);
    const result = await downloadPlatformSupportContactQueueCsv();
    setContactExporting(false);
    if (!result.ok) setPolicyMsg(userMessage(result.error, 'CSV indirilemedi'));
  };

  const filteredContactQueue = useMemo(() => {
    if (contactFilter === 'pending') return contactQueue.filter((c) => !c.hasCase);
    if (contactFilter === 'linked') return contactQueue.filter((c) => c.hasCase);
    return contactQueue;
  }, [contactQueue, contactFilter]);

  const selectedContact = useMemo(
    () => contactQueue.find((c) => c.id === selectedContactId) ?? null,
    [contactQueue, selectedContactId],
  );

  const openContactLinkedCase = (c: PlatformSupportContactQueueItem) => {
    if (!c.caseId) return;
    setSelectedCaseId(c.caseId);
    setSection('cases');
    setPolicyMsg(`Kayıt #${c.caseNumber ?? '?'}`);
  };

  const openCaseFromContact = async (contactId: string) => {
    setContactCaseSaving(true);
    const result = await createPlatformSupportCaseFromContact(contactId);
    setContactCaseSaving(false);
    if (!result.ok || !result.case) {
      setPolicyMsg(userMessage(result.error, 'Talep oluşturulamadı'));
      return;
    }
    setPolicyMsg(
      result.duplicate
        ? `Mevcut kayıt #${result.case.number}`
        : `İletişim formundan kayıt #${result.case.number} oluşturuldu`,
    );
    setSelectedCaseId(result.case.id);
    setSection('cases');
    void load();
  };

  const sendSlaApologyEmail = async (caseId: string) => {
    setSlaApologyBusyId(caseId);
    const batch = await postPlatformSupportSlaApologyBatch([caseId]);
    setSlaApologyBusyId(null);
    if (!batch.ok) {
      setPolicyMsg(userMessage(batch.error, 'Özür maili gönderilemedi'));
      return;
    }
    setPolicyMsg('SLA özür maili gönderildi (destek@ / talep e-posta zinciri)');
    void load();
  };

  const runSmokePreview = async () => {
    setSmokePreviewLoading(true);
    setSmokePreview(null);
    const result = await previewPlatformSupportSmokeFilters(smokeFilterDraft ?? undefined);
    setSmokePreviewLoading(false);
    if (!result.ok || !result.data) {
      setPolicyMsg(userMessage(result.error, 'Smoke önizleme başarısız'));
      return;
    }
    setSmokePreview(result.data);
    setPolicyMsg(
      `Smoke önizleme: ${result.data.hiddenTotal} gizli, ${result.data.visibleTotal} görünür thread`,
    );
  };

  const saveSmokeFilters = async () => {
    if (!smokeFilterDraft) return;
    setSmokeFilterSaving(true);
    const result = await savePlatformSupportSmokeFilters(smokeFilterDraft);
    setSmokeFilterSaving(false);
    if (!result.ok) {
      setPolicyMsg(userMessage(result.error, 'Smoke filtresi kaydedilemedi'));
      return;
    }
    if (result.filters) setSmokeFilterDraft(result.filters);
    setPolicyMsg('Smoke/QA filtresi kaydedildi — kuyruk yenilendi');
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
      tenantId: caseMetaDraft.tenantId.trim() || null,
      businessName: caseMetaDraft.businessName.trim() || null,
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
            {mentionUnread > 0 ? (
              <span className="platform-support-badge platform-support-badge--info" title="@mention bildirimleri">
                @{mentionUnread} yeni
              </span>
            ) : null}
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
            <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
            <button
              type="button"
              className={`platform-support-hero-link ${contactWithoutCase > 0 ? 'is-warn' : ''}`}
              onClick={() => setSection('contact')}
            >
              {contactWithoutCase} form
            </button>
            {(data.opsSignals?.outboxFailed ?? 0) > 0 ? (
              <>
                <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
                <button
                  type="button"
                  className="platform-support-hero-link is-warn"
                  title="Altyapı → outbox kiracı"
                  onClick={() => platformNav?.goToTab('infrastructure')}
                >
                  {data.opsSignals?.outboxFailed} outbox fail
                </button>
              </>
            ) : null}
            {(data.opsSignals?.platformAlertsCritical ?? 0) > 0 ? (
              <>
                <span className="platform-support-compact-hero-dot" aria-hidden>·</span>
                <button
                  type="button"
                  className="platform-support-hero-link is-warn"
                  title="Genel bakış → kiracı uyarıları"
                  onClick={() => platformNav?.goToTab('overview')}
                >
                  {data.opsSignals?.platformAlertsCritical} kritik uyarı
                </button>
              </>
            ) : null}
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
          className={`platform-support-subnav-btn ${section === 'contact' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('contact')}
        >
          İletişim formu
          {contactWithoutCase > 0 ? (
            <span className="platform-support-subnav-count">{contactWithoutCase}</span>
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
        <div className="platform-support-cases-premium">
          <header className="platform-support-cases-hero">
            <div>
              <h3>Operasyon kayıtları (Case)</h3>
              <p className="platform-support-hint">
                Soldan kayıt seçin — ortada #{selectedCase?.number ?? '…'} detayı, sağda Kiracı 360.
              </p>
            </div>
            <div className="platform-support-cases-hero-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setManualCaseOpen((v) => !v)}
              >
                {manualCaseOpen ? 'Manuel iptal' : 'Manuel kayıt'}
              </button>
            </div>
          </header>
          <div className="platform-support-cases-grid">
          <aside className="platform-panel platform-panel--premium platform-support-case-rail">
            <div className="platform-support-case-toolbar">
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
            </div>
            <nav className="platform-support-case-mailbox" aria-label="Kayıt klasörleri">
              {(['active', 'solved', 'closed', 'all'] as CaseListMailbox[]).map((box) => (
                <button
                  key={box}
                  type="button"
                  className={`platform-support-case-mailbox-btn${caseListMailbox === box ? ' is-active' : ''}`}
                  aria-current={caseListMailbox === box ? 'true' : undefined}
                  onClick={() => {
                    setCaseListMailbox(box);
                    setSelectedCaseId(null);
                  }}
                >
                  {CASE_MAILBOX_LABELS[box]}
                </button>
              ))}
            </nav>
            <div className="platform-support-case-filters">
              {caseListMailbox === 'active' ? (
                <PlatformFilterSelect
                  label="Açık durum"
                  icon="role"
                  value={caseListActiveSub}
                  onChange={(v) => {
                    setCaseListActiveSub(v);
                    setSelectedCaseId(null);
                  }}
                >
                  <option value="active">Tüm açıklar</option>
                  <option value="new">Yeni</option>
                  <option value="open">Açık</option>
                  <option value="pending">Beklemede</option>
                </PlatformFilterSelect>
              ) : null}
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
              <PlatformFilterSelect
                label="Etiket"
                icon="role"
                value={caseListTag}
                onChange={(v) => setCaseListTag(v)}
              >
                <option value="all">Tümü</option>
                {caseTagOptions.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </PlatformFilterSelect>
            </div>
            <ul className="platform-support-case-rail-list" role="listbox" aria-label="Operasyon kayıtları">
              {caseRows.length === 0 ? (
                <li className="platform-support-case-rail-empty">Henüz kayıt yok</li>
              ) : (
                caseRows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCaseId === c.id}
                      className={`platform-support-case-rail-item${selectedCaseId === c.id ? ' is-selected' : ''}`}
                      onClick={() => selectSupportCase(c)}
                    >
                      <span className="platform-support-case-rail-num">#{c.number}</span>
                      <span className="platform-support-case-rail-subject">{c.subject}</span>
                      <span className="platform-support-case-rail-meta">
                        <span className={`platform-support-status-pill platform-support-status-pill--${c.status}`}>
                          {CASE_STATUS_LABELS[c.status] ?? c.status}
                        </span>
                        <span className="platform-table-muted">{CASE_KIND_LABELS[c.kind] ?? c.kind}</span>
                        {c.externalTicketRef?.id ? (
                          <span className="platform-table-muted">ZD #{c.externalTicketRef.id}</span>
                        ) : null}
                      </span>
                      {(c.tags ?? []).length > 0 ? (
                        <span className="platform-support-tag-chips">
                          {(c.tags ?? []).slice(0, 3).map((tag) => (
                            <span key={tag} className="platform-support-tag-chip">{tag}</span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>
          <section className="platform-panel platform-panel--premium platform-support-case-workspace">
            {selectedCase ? (
              <>
                <header className="platform-support-case-workspace-head">
                  <div>
                    <h3>#{selectedCase.number} — {selectedCase.subject}</h3>
                    <p className="platform-table-muted">
                      {selectedCase.channel} · {selectedCase.requesterEmail ?? selectedCase.requesterName ?? '—'}
                    </p>
                  </div>
                  <div className="platform-support-case-workspace-badges">
                    <span className={`platform-support-status-pill platform-support-status-pill--${selectedCase.status}`}>
                      {CASE_STATUS_LABELS[selectedCase.status] ?? selectedCase.status}
                    </span>
                    {selectedCase.slaDueAt ? (
                      <span className="platform-support-sla-chip" title="SLA bitiş">
                        SLA {new Date(selectedCase.slaDueAt).toLocaleString('tr-TR')}
                      </span>
                    ) : null}
                  </div>
                </header>
                <div className="platform-support-policy-form platform-support-case-meta">
                  <div className="platform-support-case-meta-selects">
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
                  </div>
                  <div className="platform-support-case-meta-fields">
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Atanan</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.assignee}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, assignee: e.target.value }))}
                      placeholder="operatör kullanıcı adı"
                      list="platform-support-assignee-options"
                    />
                  </label>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Etiketler</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.tags}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, tags: e.target.value }))}
                      placeholder="messaging, vip (virgülle)"
                    />
                  </label>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">Kiracı ID</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.tenantId}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, tenantId: e.target.value }))}
                      placeholder="main"
                      onBlur={() => {
                        const tid = caseMetaDraft.tenantId.trim();
                        if (tid) setContextTenantId(tid);
                      }}
                    />
                  </label>
                  <label className="platform-support-field">
                    <span className="platform-support-field-label">İşletme adı</span>
                    <input
                      className="platform-support-control"
                      value={caseMetaDraft.businessName}
                      onChange={(e) => setCaseMetaDraft((d) => ({ ...d, businessName: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm platform-support-case-save-btn"
                    disabled={caseMetaSaving}
                    onClick={() => void saveCaseMeta()}
                  >
                    {caseMetaSaving ? 'Kaydediliyor…' : 'Kaydı güncelle'}
                  </button>
                  </div>
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
                  {replyChannel === 'note' ? 'İç not (@operatör ile bildirim)' : 'Yanıt metni'}
                  <textarea rows={5} value={actionDraft} onChange={(e) => setActionDraft(e.target.value)} />
                  {replyChannel === 'note' && mentionOperators.length ? (
                    <p className="platform-support-hint">
                      @mention: {mentionOperators.map((o) => `@${o.username}`).join(', ')}
                    </p>
                  ) : null}
                </label>
                <datalist id="platform-support-assignee-options">
                  {assigneeOptions.map((o) => (
                    <option key={o.username} value={o.username}>{o.displayName}</option>
                  ))}
                </datalist>
                <div className="platform-support-case-compose-actions">
                <button type="button" className="btn btn-primary" onClick={() => void sendCaseAction()} disabled={!actionDraft.trim()}>
                  Gönder
                </button>
                </div>
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
          <PlatformSupportTenant360
            tenantId={selectedCase ? resolveCaseTenantId(selectedCase) : null}
            casePreview={
              selectedCase
                ? {
                    number: selectedCase.number,
                    subject: selectedCase.subject,
                    requesterEmail: selectedCase.requesterEmail,
                    requesterName: selectedCase.requesterName,
                    channel: selectedCase.channel,
                    tenantHint: resolveCaseTenantId(selectedCase),
                  }
                : null
            }
            onMessage={setPolicyMsg}
          />
          </div>
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
          onSendSlaApology={(caseId) => void sendSlaApologyEmail(caseId)}
          slaApologyBusyId={slaApologyBusyId}
          onSendSlaApologyBatch={(caseIds) => {
            setSlaApologyBatchBusy(true);
            void postPlatformSupportSlaApologyBatch(caseIds).then((batch) => {
              setSlaApologyBatchBusy(false);
              if (!batch.ok) {
                setPolicyMsg(userMessage(batch.error, 'Toplu özür maili başarısız'));
                return;
              }
              setPolicyMsg(`SLA özür: ${batch.sent ?? 0} gönderildi, ${batch.failed ?? 0} hata`);
              void load();
            });
          }}
          slaApologyBatchBusy={slaApologyBatchBusy}
        />
      ) : null}

      {section === 'inbox' ? (
        <div className="platform-support-inbox-layout">
          <section className="platform-panel platform-panel--premium platform-support-inbox-list">
            <div className="platform-panel-head">
              <h3>{inboxMailbox === 'sent' ? 'destek@ giden yanıtlar' : 'destek@ gelen'}</h3>
              <button type="button" className="btn btn-secondary" onClick={() => void onInboxSync()} disabled={inboxSyncing}>
                {inboxSyncing ? 'Senkron…' : mailboxConfigured ? 'IMAP + outbox' : 'Güncelle'}
              </button>
              {inboxMailbox === 'inbound' ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={inboxMarkingRead || filteredInboxThreads.length === 0}
                  onClick={() => void markVisibleInboxRead()}
                >
                  {inboxMarkingRead ? '…' : 'Görünenleri okundu'}
                </button>
              ) : null}
            </div>
            <nav className="platform-support-case-mailbox platform-support-inbox-mailbox" aria-label="Posta klasörleri">
              <button
                type="button"
                className={`platform-support-case-mailbox-btn${inboxMailbox === 'inbound' ? ' is-active' : ''}`}
                aria-current={inboxMailbox === 'inbound' ? 'true' : undefined}
                onClick={() => {
                  setInboxMailbox('inbound');
                  setSelectedSentId(null);
                }}
              >
                Gelen
              </button>
              <button
                type="button"
                className={`platform-support-case-mailbox-btn${inboxMailbox === 'sent' ? ' is-active' : ''}`}
                aria-current={inboxMailbox === 'sent' ? 'true' : undefined}
                onClick={() => {
                  setInboxMailbox('sent');
                  setSelectedMailId(null);
                }}
              >
                Giden yanıtlar
              </button>
            </nav>
            <div className="platform-support-inbox-filters">
              {inboxMailbox === 'inbound' ? (
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
              ) : null}
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
            {inboxMailbox === 'inbound' && !mailboxConfigured ? (
              <p className="platform-support-hint">
                Mağaza <strong>Posta</strong> üzerinden <code>destek@ekolojikmarket.com.tr</code> adresine yazılanlar burada listelenir
                (outbox köprüsü). Gönderim <strong>PENDING</strong> ise SMTP henüz çıkmamış olabilir; yine de gelen kutusunda görünür.
                Harici posta ve IMAP için VPS’te <code>EKOLOJIK_SUPPORT_IMAP_*</code> —{' '}
                <code>scripts/sunucu-ekolojik-destek-mailbox.sh</code>
              </p>
            ) : inboxMailbox === 'inbound' ? (
              <p className="platform-support-hint platform-table-muted">
                IMAP ile dış mail + mağaza outbox birlikte senkronlanır.
              </p>
            ) : (
              <p className="platform-support-hint platform-table-muted">
                Operatör yanıtları, otomatik alındılar ve talep e-posta thread kayıtları. Gönderim SMTP/outbox üzerinden yapılır.
              </p>
            )}
            <ul className="platform-support-inbox-items">
              {inboxMailbox === 'sent' ? (
                inboxSentMessages.length === 0 ? (
                  <li className="platform-support-inbox-empty">Henüz giden yanıt kaydı yok.</li>
                ) : filteredInboxSent.length === 0 ? (
                  <li className="platform-support-inbox-empty">Aramaya uyan giden yanıt yok.</li>
                ) : (
                  filteredInboxSent.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`platform-support-inbox-item platform-support-inbox-item--sent ${selectedSentId === row.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedSentId(row.id)}
                      >
                        <span className="platform-support-inbox-item-subject">
                          {row.subject || '(konu yok)'}
                          {row.caseNumber ? (
                            <span className="platform-support-inbox-case-badge">#{row.caseNumber}</span>
                          ) : null}
                        </span>
                        <span className="platform-comms-folder platform-comms-folder--sent">{row.kindLabel}</span>
                        <span className="platform-support-inbox-item-from">Kime: {row.to ?? '—'}</span>
                        <span className="platform-support-inbox-item-date">{formatDateTime(row.sentAt)}</span>
                      </button>
                    </li>
                  ))
                )
              ) : inboxMessages.length === 0 ? (
                <li className="platform-support-inbox-empty">
                  Henüz kayıt yok — yöneticiden destek@ gönderin veya Güncelle’ye basın.
                </li>
              ) : filteredInboxThreads.length === 0 ? (
                <li className="platform-support-inbox-empty">Filtreye uyan mail yok.</li>
              ) : (
                filteredInboxThreads.map(({ head, count, key }) => {
                  const threadRootId = inboxThreadKey(head);
                  const threadCase = caseByInboxRoot.get(threadRootId);
                  return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`platform-support-inbox-item ${inboxThreadKey(selectedMail ?? head) === key ? 'is-selected' : ''} ${!head.readAt ? 'is-unread' : ''}`}
                      onClick={() => setSelectedMailId(head.id)}
                    >
                      <span className="platform-support-inbox-item-subject">
                        {head.subject || '(konu yok)'}
                        {threadCase ? (
                          <button
                            type="button"
                            className="platform-support-inbox-case-badge"
                            title="Kaydı aç"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLinkedCase(threadCase);
                            }}
                          >
                            #{threadCase.number}
                          </button>
                        ) : null}
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
                  );
                })
              )}
            </ul>
          </section>
          <section className="platform-panel platform-panel--premium platform-support-inbox-detail">
            {inboxMailbox === 'sent' && selectedSent ? (
              <>
                <h3>{selectedSent.subject || 'Giden yanıt'}</h3>
                <p className="platform-table-muted">
                  Kime: {selectedSent.to ?? '—'} · {selectedSent.kindLabel}
                  {selectedSent.repliedBy ? ` · ${selectedSent.repliedBy}` : ''}
                </p>
                <p className="platform-table-muted">{formatDateTime(selectedSent.sentAt)}</p>
                <div className="platform-support-inbox-detail-actions">
                  {selectedSent.caseId ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setSection('cases');
                        setSelectedCaseId(selectedSent.caseId!);
                      }}
                    >
                      Talep #{selectedSent.caseNumber} aç
                    </button>
                  ) : null}
                  {selectedSent.inboxMessageId ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setInboxMailbox('inbound');
                        setSelectedMailId(selectedSent.inboxMessageId!);
                        setSelectedSentId(null);
                      }}
                    >
                      İlgili gelen mail
                    </button>
                  ) : null}
                </div>
                <div className="platform-support-inbox-body">
                  {selectedSent.preview ?? '(önizleme yok)'}
                </div>
                {selectedSent.htmlPreview ? (
                  <details className="platform-support-email-html-details">
                    <summary>HTML önizleme</summary>
                    <SupportEmailHtmlFrame html={selectedSent.htmlPreview} title="Giden yanıt" />
                  </details>
                ) : null}
                {selectedSent.messageId ? (
                  <p className="platform-table-muted">
                    Message-ID: <code className="platform-support-mono-truncate">{selectedSent.messageId}</code>
                  </p>
                ) : null}
              </>
            ) : inboxMailbox === 'sent' ? (
              <p className="platform-support-hint">Listeden bir giden yanıt seçin.</p>
            ) : selectedMail ? (
              <>
                <div className="platform-support-inbox-detail-actions">
                  {selectedMailCase ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openLinkedCase(selectedMailCase)}
                    >
                      Kayıt #{selectedMailCase.number} aç
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={inboxCaseCreating}
                      onClick={() => void openCaseFromInbox()}
                    >
                      {inboxCaseCreating ? 'Oluşturuluyor…' : 'Talep oluştur'}
                    </button>
                  )}
                </div>
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

      {section === 'contact' ? (
        <div className="platform-support-inbox-layout">
          <section className="platform-panel platform-panel--premium platform-support-inbox-list">
            <div className="platform-panel-head">
              <h3>İletişim formu kuyruğu</h3>
              <span className="platform-table-muted">
                {contactWithoutCase} talep bekliyor · {contactQueue.length} kayıt
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={contactExporting}
                onClick={() => void onExportContactQueue()}
              >
                {contactExporting ? '…' : 'CSV'}
              </button>
            </div>
            <p className="platform-support-hint">
              Yeni formlar otomatik talep oluşturur (<code>contact-form</code> etiketi). Eski kayıtlar için manuel
              &quot;Talep oluştur&quot; kullanın.
            </p>
            <div className="platform-support-inbox-filters">
              <PlatformFilterSelect
                label="Durum"
                icon="role"
                value={contactFilter}
                onChange={(v) => setContactFilter(v as typeof contactFilter)}
              >
                <option value="pending">Talep bekliyor</option>
                <option value="all">Tümü</option>
                <option value="linked">Bağlı kayıt</option>
              </PlatformFilterSelect>
            </div>
            <table className="platform-table platform-table--scroll">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Konu</th>
                  <th>Gönderen</th>
                  <th>Kayıt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredContactQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Kayıt yok</td>
                  </tr>
                ) : (
                  filteredContactQueue.map((c) => (
                    <tr
                      key={c.id}
                      className={c.id === selectedContactId ? 'platform-support-row--selected' : undefined}
                    >
                      <td>{formatDateTime(c.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-text"
                          onClick={() => setSelectedContactId(c.id)}
                        >
                          {c.subject}
                        </button>
                      </td>
                      <td>
                        {c.name}
                        <span className="platform-table-muted">{c.email}</span>
                      </td>
                      <td>
                        {c.hasCase ? (
                          <button type="button" className="btn btn-text" onClick={() => openContactLinkedCase(c)}>
                            #{c.caseNumber}
                          </button>
                        ) : (
                          <span className="platform-table-muted">—</span>
                        )}
                      </td>
                      <td>
                        {c.hasCase ? (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openContactLinkedCase(c)}>
                            Aç
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={contactCaseSaving}
                            onClick={() => void openCaseFromContact(c.id)}
                          >
                            Talep oluştur
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
          <section className="platform-panel platform-panel--premium platform-support-inbox-read">
            <h3>Form detayı</h3>
            {selectedContact ? (
              <>
                <p className="platform-support-inbox-meta">
                  <strong>{selectedContact.name}</strong> · {selectedContact.email}
                  <br />
                  {formatDateTime(selectedContact.createdAt)}
                </p>
                <h4>{selectedContact.subject}</h4>
                <div className="platform-support-inbox-body">
                  {selectedContact.message || selectedContact.messagePreview || '—'}
                </div>
                {selectedContact.hasCase ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => openContactLinkedCase(selectedContact)}
                  >
                    Kayıt #{selectedContact.caseNumber} aç
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={contactCaseSaving}
                    onClick={() => void openCaseFromContact(selectedContact.id)}
                  >
                    {contactCaseSaving ? 'Oluşturuluyor…' : 'Talep oluştur'}
                  </button>
                )}
              </>
            ) : (
              <p className="platform-support-hint">Soldan bir form seçin.</p>
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
                <th>Kayıt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7}>Kuyruk boş</td>
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
                          onClick={() => openLinkedCase(linkedCase)}
                        >
                          Aç #{linkedCase.number}
                          {linkedCase.status === 'closed' || linkedCase.status === 'solved'
                            ? ` (${linkedCase.status})`
                            : ''}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-text" onClick={() => void openCaseFromQueue(q)}>
                          Talep oluştur
                        </button>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openQueueMessaging(q)}>
                        Sohbet
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="platform-panel platform-panel--premium platform-support-skills">
        <div className="platform-panel-head">
          <h3>Skill routing (atama)</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSkillsOpen((v) => !v)}>
            {skillsOpen ? 'Gizle' : 'Düzenle'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={skillsSaving || !skillsHub}
            onClick={async () => {
              if (!skillsHub) return;
              setSkillsSaving(true);
              const result = await savePlatformSupportSkills(skillsHub);
              setSkillsSaving(false);
              if (!result.ok) setError(result.error ?? 'Skill kaydedilemedi');
            }}
          >
            {skillsSaving ? '…' : 'Kaydet'}
          </button>
        </div>
        <p className="platform-support-hint">
          Vaka etiketi veya kanal → skill havuzu → round-robin atama (kapasite: maxOpenCases). Dosya:{' '}
          <code>data/platform/support-skills.json</code>
        </p>
        {skillsOpen && skillsHub ? (
          <div className="platform-support-smoke-form">
            {skillsHub.skills.map((skill, idx) => (
              <div key={skill.id} className="platform-support-field">
                <span className="platform-support-field-label">
                  {skill.label} (<code>{skill.id}</code>)
                </span>
                <textarea
                  className="platform-support-control"
                  rows={2}
                  placeholder="operatör kullanıcı adları (satır başına)"
                  value={skill.assignees.join('\n')}
                  onChange={(e) =>
                    setSkillsHub((h) =>
                      h
                        ? {
                            ...h,
                            skills: h.skills.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    assignees: e.target.value
                                      .split('\n')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                  }
                                : s,
                            ),
                          }
                        : h,
                    )
                  }
                />
                <label className="platform-support-field platform-support-field--inline">
                  <span>Max açık vaka (0=sınırsız)</span>
                  <input
                    type="number"
                    min={0}
                    className="platform-support-control"
                    style={{ maxWidth: 120 }}
                    value={skill.maxOpenCases}
                    onChange={(e) =>
                      setSkillsHub((h) =>
                        h
                          ? {
                              ...h,
                              skills: h.skills.map((s, i) =>
                                i === idx ? { ...s, maxOpenCases: Number(e.target.value) || 0 } : s,
                              ),
                            }
                          : h,
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="platform-support-hint">
            {skillsHub?.skills.length ?? 0} skill tanımı · operatör listesi: {assigneeOptions.length}
          </p>
        )}
      </section>

      <section className="platform-panel platform-panel--premium platform-support-smoke-filters">
        <div className="platform-panel-head">
          <h3>Smoke / QA filtresi</h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={smokePreviewLoading}
            onClick={() => void runSmokePreview()}
          >
            {smokePreviewLoading ? '…' : 'Önizle / test'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setSmokeFilterOpen((v) => !v)}
          >
            {smokeFilterOpen ? 'Gizle' : 'Düzenle'}
          </button>
        </div>
        <p className="platform-support-hint">
          Test ve smoke mesaj thread’leri operasyon kuyruğundan gizlenir. Dosya:{' '}
          <code>data/platform/support-filters.json</code>
        </p>
        {smokeFilterOpen && smokeFilterDraft ? (
          <div className="platform-support-smoke-form">
            <label className="platform-support-field platform-support-field--inline">
              <input
                type="checkbox"
                checked={smokeFilterDraft.hideSmoke}
                onChange={(e) =>
                  setSmokeFilterDraft((d) => (d ? { ...d, hideSmoke: e.target.checked } : d))
                }
              />
              <span>Smoke/QA gizle (kuyruk + SLA metrikleri)</span>
            </label>
            <label className="platform-support-field">
              <span className="platform-support-field-label">Kiracı ID (satır başına)</span>
              <textarea
                className="platform-support-control"
                rows={3}
                value={smokeFilterDraft.tenantIds.join('\n')}
                onChange={(e) =>
                  setSmokeFilterDraft((d) =>
                    d
                      ? {
                          ...d,
                          tenantIds: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        }
                      : d,
                  )
                }
              />
            </label>
            <label className="platform-support-field">
              <span className="platform-support-field-label">Konu / önizleme regex (satır başına, i)</span>
              <textarea
                className="platform-support-control"
                rows={4}
                value={smokeFilterDraft.subjectPatterns.join('\n')}
                onChange={(e) =>
                  setSmokeFilterDraft((d) =>
                    d
                      ? {
                          ...d,
                          subjectPatterns: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        }
                      : d,
                  )
                }
              />
            </label>
            <label className="platform-support-field">
              <span className="platform-support-field-label">Müşteri adı regex (satır başına, i)</span>
              <textarea
                className="platform-support-control"
                rows={3}
                value={smokeFilterDraft.customerNamePatterns.join('\n')}
                onChange={(e) =>
                  setSmokeFilterDraft((d) =>
                    d
                      ? {
                          ...d,
                          customerNamePatterns: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        }
                      : d,
                  )
                }
              />
            </label>
            <label className="platform-support-field platform-support-field--inline">
              <input
                type="checkbox"
                checked={Boolean(smokeFilterDraft.slaHumanOnly)}
                onChange={(e) =>
                  setSmokeFilterDraft((d) => (d ? { ...d, slaHumanOnly: e.target.checked } : d))
                }
              />
              <span>SLA uyumu: yalnızca insan (bot ilk yanıt sayılmaz)</span>
            </label>
            <label className="platform-support-field">
              <span className="platform-support-field-label">
                Mesaj kanalları (boş = tümü; satır başına: web, platform, …)
              </span>
              <textarea
                className="platform-support-control"
                rows={2}
                value={(smokeFilterDraft.messagingChannels ?? []).join('\n')}
                onChange={(e) =>
                  setSmokeFilterDraft((d) =>
                    d
                      ? {
                          ...d,
                          messagingChannels: e.target.value
                            .split('\n')
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean),
                        }
                      : d,
                  )
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={smokeFilterSaving}
              onClick={() => void saveSmokeFilters()}
            >
              {smokeFilterSaving ? 'Kaydediliyor…' : 'Filtreyi kaydet'}
            </button>
          </div>
        ) : (
          <p className="platform-table-muted">
            {smokeFilterDraft?.hideSmoke ? 'Aktif' : 'Kapalı'} ·{' '}
            {smokeFilterDraft?.tenantIds.length ?? 0} kiracı ·{' '}
            {(smokeFilterDraft?.subjectPatterns.length ?? 0) + (smokeFilterDraft?.customerNamePatterns.length ?? 0)}{' '}
            desen
            {smokeFilterDraft?.slaHumanOnly ? ' · SLA insan' : ''}
            {(smokeFilterDraft?.messagingChannels?.length ?? 0) > 0
              ? ` · ${smokeFilterDraft?.messagingChannels?.length} kanal`
              : ''}
          </p>
        )}
        {smokePreview ? (
          <div className="platform-support-smoke-preview">
            <p className="platform-support-hint">
              Önizleme: <strong>{smokePreview.hiddenTotal}</strong> gizlenecek,{' '}
              <strong>{smokePreview.visibleTotal}</strong> operasyon kuyruğunda kalacak (son 200 thread / kiracı).
            </p>
            {smokePreview.samples.length === 0 ? (
              <p className="platform-table-muted">Örnek gizli thread yok.</p>
            ) : (
              <table className="platform-table platform-table--scroll">
                <thead>
                  <tr>
                    <th>Kiracı</th>
                    <th>Müşteri</th>
                    <th>Konu</th>
                    <th>Neden</th>
                  </tr>
                </thead>
                <tbody>
                  {smokePreview.samples.map((row) => (
                    <tr key={`${row.tenantId}:${row.threadId}`}>
                      <td>
                        {row.businessName}
                        <span className="platform-table-muted">{row.tenantId}</span>
                      </td>
                      <td>{row.customerName}</td>
                      <td>{row.subject}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </section>

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
