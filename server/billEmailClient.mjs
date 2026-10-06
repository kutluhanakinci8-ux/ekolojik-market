/**
 * Ekolojik fatura e-posta altyapısı — IMAP (Faz 4, NB inbound yok).
 */

import { verifyImapMailbox, fetchRecentInboxMessages } from './billEmailImap.mjs';
import { saveBillEmailInboxBatch } from './billEmailInboxStore.mjs';
import {
  matchBillEmailToSource,
  parseBillHintsFromText,
  buildPollItem,
} from './billEmailParser.mjs';

function mergeEnvImap(config) {
  const base = { ...(config ?? {}) };
  if (!base.imapHost?.trim() && process.env.EKOLOJIK_IMAP_HOST?.trim()) {
    base.imapHost = process.env.EKOLOJIK_IMAP_HOST.trim();
  }
  if (!base.imapUser?.trim() && process.env.EKOLOJIK_IMAP_USER?.trim()) {
    base.imapUser = process.env.EKOLOJIK_IMAP_USER.trim();
  }
  if (!base.imapPassword && process.env.EKOLOJIK_IMAP_PASS) {
    base.imapPassword = process.env.EKOLOJIK_IMAP_PASS;
  }
  if (!base.inboxAddress?.trim() && process.env.EKOLOJIK_IMAP_INBOX?.trim()) {
    base.inboxAddress = process.env.EKOLOJIK_IMAP_INBOX.trim();
  }
  if (!Number(base.imapPort) && process.env.EKOLOJIK_IMAP_PORT) {
    base.imapPort = Number(process.env.EKOLOJIK_IMAP_PORT);
  }
  return base;
}

/** Node sunucusu — TS modülü doğrudan import edilemez; inline normalize */
function normalizeConfig(raw) {
  const merged = mergeEnvImap(raw);
  const settings = {
    enabled: merged.enabled === true,
    inboxMode: merged.inboxMode ?? 'plus_alias',
    inboxAddress: merged.inboxAddress ?? '',
    imapHost: merged.imapHost ?? 'imap.gmail.com',
    imapPort: Number(merged.imapPort || 993),
    imapUser: merged.imapUser ?? '',
    imapPassword: merged.imapPassword ?? '',
    pollIntervalMin: Number(merged.pollIntervalMin || 30),
    sources: Array.isArray(merged.sources) ? merged.sources : [],
    lastPollAt: merged.lastPollAt,
  };

  const inbox = settings.inboxAddress.trim();
  const imapUser = settings.imapUser.trim() || inbox;
  const sources = settings.sources.map((source) => {
    let forwardingAlias = String(source.forwardingAlias ?? '').trim();
    if (settings.inboxMode === 'dedicated_gmail') {
      forwardingAlias = inbox;
    } else if (settings.inboxMode === 'plus_alias' && inbox && source.aliasTag) {
      const at = inbox.indexOf('@');
      if (at > 0) {
        const local = inbox.slice(0, at).split('+')[0];
        const domain = inbox.slice(at + 1);
        const tag = String(source.aliasTag).trim().toLowerCase();
        forwardingAlias = `${local}+${tag}@${domain}`;
      }
    }
    return { ...source, forwardingAlias };
  });

  return { ...settings, imapUser, sources };
}

export async function testBillEmailConnection(config) {
  const normalized = normalizeConfig(config);
  const host = String(normalized.imapHost || '').trim();
  const user = String(normalized.imapUser || normalized.inboxAddress || '').trim();
  const password = String(normalized.imapPassword || '').trim();
  const port = Number(normalized.imapPort || 993);

  if (!user) {
    return { ok: false, message: 'E-posta adresi veya IMAP kullanıcı adı gerekli' };
  }
  if (!password) {
    return {
      ok: false,
      message: 'IMAP şifresi veya Gmail uygulama şifresi girin. Gmail için: Hesap → Güvenlik → 2 Adımlı Doğrulama → Uygulama şifreleri',
    };
  }
  if (!host) {
    return { ok: false, message: 'IMAP sunucu adresi gerekli (Gmail: imap.gmail.com)' };
  }

  try {
    const result = await verifyImapMailbox({
      imapHost: host,
      imapPort: port,
      imapUser: user,
      imapPassword: password,
      inboxAddress: normalized.inboxAddress,
    });
    return {
      ok: true,
      message: result.message,
      mailboxCount: result.mailboxCount,
      unseenCount: result.unseenCount,
      provider: 'ekolojik-imap',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'IMAP bağlantısı başarısız',
    };
  }
}

export async function pollBillEmails(dataDir, config, tenantId = 'main') {
  const normalized = normalizeConfig(config);
  const test = await testBillEmailConnection(normalized);
  if (!test.ok) {
    return { ok: false, message: test.message, processed: 0, items: [] };
  }

  const enabledSources = (normalized.sources || []).filter((item) => item?.enabled);
  if (!enabledSources.length) {
    return {
      ok: true,
      message: 'Aktif fatura kaynağı yok. Ayarlardan kaynak ekleyin.',
      processed: 0,
      items: [],
    };
  }

  const sinceDate = normalized.lastPollAt ? new Date(normalized.lastPollAt) : new Date(Date.now() - 14 * 86400000);

  let fetched = [];
  try {
    fetched = await fetchRecentInboxMessages(
      {
        imapHost: normalized.imapHost,
        imapPort: normalized.imapPort,
        imapUser: normalized.imapUser,
        imapPassword: normalized.imapPassword,
        inboxAddress: normalized.inboxAddress,
      },
      { sinceDate, maxMessages: 60 },
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'IMAP tarama hatası',
      processed: 0,
      items: [],
    };
  }

  const toStore = [];
  const items = [];

  for (const msg of fetched) {
    const source = matchBillEmailToSource(msg, enabledSources, normalized.inboxMode);
    const hints = parseBillHintsFromText(`${msg.subject}\n${msg.text}`);
    const row = {
      imapUid: msg.imapUid,
      messageId: msg.messageId,
      sourceId: source?.id ?? null,
      sourceLabel: source?.label ?? null,
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      snippet: msg.snippet,
      amount: hints.amount,
      dueDate: hints.dueDate,
    };
    toStore.push(row);
    if (source) {
      items.push(buildPollItem(row));
    }
  }

  const saved = await saveBillEmailInboxBatch(dataDir, tenantId, toStore);

  return {
    ok: true,
    message: `${fetched.length} e-posta tarandı · ${saved.added.length} yeni kayıt · ${items.length} kaynak eşleşmesi`,
    processed: saved.added.length,
    matched: items.length,
    scanned: fetched.length,
    items,
    provider: 'ekolojik-imap',
  };
}

export { listBillEmailInbox } from './billEmailInboxStore.mjs';
