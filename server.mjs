import { createServer } from 'node:http';
import { loadMarketPosEnv } from './server/loadEnv.mjs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAsatDebt, probeAsatConnectivity } from './server/asatClient.mjs';
import { createFaturaSession, queryFaturaDebt } from './server/faturaOdemelisinClient.mjs';
import { prepareOdemeSession, queryOdemeDebt } from './server/odemeComTrClient.mjs';
import { pollBillEmails, testBillEmailConnection, listBillEmailInbox } from './server/billEmailClient.mjs';
import {
  readTenantStore,
  writeTenantStore,
  registerTenant,
  saveContactMessage,
  listContactMessages,
} from './server/tenantAuth.mjs';
import { sendContactNotifications, isContactAutoreplyEnabled } from './server/contactMail.mjs';
import { applyIrsaliyeStockToStoreSnapshot } from './server/irsaliyeStock.mjs';
import { sendCrmEmail } from './server/crmOutreach.mjs';
import {
  getEkolojikMailConfig,
  getEkolojikOpsEmail,
  getEkolojikSmtpHostHint,
  getEkolojikImapConfig,
  isEkolojikSmtpConfigured,
  isEkolojikImapConfigured,
} from './server/ekolojikMailConfig.mjs';
import { verifyEkolojikSmtp } from './server/ekolojikSmtp.mjs';
import { verifyImapMailbox } from './server/billEmailImap.mjs';
import { getOutboxCounts, listRecentOutbox, listMergedRecentOutbox, requeueFailedOutboxMessage, findOutboxMessageById } from './server/emailOutbox.mjs';
import {
  createDeliverMessage,
  processPendingOutbox,
  sendEkolojikMail,
} from './server/emailOutboxProcessor.mjs';
import {
  getPostaMailSettings,
  savePostaMailSettings,
  getEffectiveMailPresentation,
  getPostaNotificationsMatrixHub,
} from './server/postaSettings.mjs';
import {
  buildOutboxCsv,
  buildContactCsv,
  buildMessagingExportZip,
} from './server/postaExport.mjs';
import {
  isLertaPlatformConfigured,
  listMessagingThreads as listLertaMessagingThreads,
  sendMessagingMessage as sendLertaMessagingMessage,
} from './server/lertaPlatformBridge.mjs';
import {
  listMessagingThreads,
  getMessagingThread,
  createMessagingThread,
  listMessagingMessages,
  appendMessagingMessage,
  markMessagingThreadStaffRead,
  patchMessagingThread,
  searchMessagingInThread,
} from './server/messaging/store.mjs';
import { notifyOnMessagingMessage } from './server/messaging/notify.mjs';
import { getEkolojikIsolationReport } from './server/ekolojikIsolationCheck.mjs';
import { readMessagingAttachment } from './server/messaging/attachments.mjs';
import {
  runEkolojikDataRetention,
  getRetentionPolicySummary,
} from './server/dataRetention.mjs';
import {
  archivePostaInboxItem,
  getPostaUnreadCounts,
  listUnifiedPostaInbox,
  markPostaInboxRead,
  syncPostaInboxFromImap,
  getComposeRecipientHints,
  loadPostaInboxAttachment,
  applyPostaInboxFlags,
  listUnifiedPostaSent,
} from './server/postaInbox.mjs';
import {
  deletePostaComposeDraft,
  listPostaComposeDrafts,
  upsertPostaComposeDraft,
} from './server/postaComposeDrafts.mjs';
import { listMailTemplates } from './server/mailTemplates.mjs';
import { formatPostaComposeBody } from './server/postaComposeFormat.mjs';
import {
  getPostaComposeRteCapabilities,
  sanitizePostaComposeHtml,
  stripHtmlToPlainText,
} from './server/postaComposeRte.mjs';
import { validateOutboundAttachments } from './server/postaComposeActions.mjs';
import {
  listPostaContacts,
  upsertPostaContact,
  deletePostaContact,
  contactsToVcard,
  parseVcardImport,
  parseCsvContactsImport,
  importPostaContacts,
} from './server/postaContacts.mjs';
import {
  listPostaCalendar,
  upsertPostaCalendarEvent,
  deletePostaCalendarEvent,
  createCalendarEventFromMail,
  syncPaymentRemindersSnapshot,
} from './server/postaCalendar.mjs';
import { getPostaStorageSummary } from './server/postaStorage.mjs';
import { batchPostaInboxAction, markAllPostaInboxReadInFolder } from './server/postaInboxBatch.mjs';
import { listPostaRules, savePostaRules } from './server/postaRules.mjs';
import { getPostaOutboxAnalytics } from './server/postaOutboxAnalytics.mjs';
import { getPostaDeliverabilityHub } from './server/postaDeliverability.mjs';
import { suggestPostaCompose, isPostaAiEnabled } from './server/postaAiCompose.mjs';
import { recordMailOpen, mailTrackPixelResponse } from './server/postaMailTrack.mjs';
let handleAsatProxy = null;
let ASAT_PROXY_PREFIX = '/asat-proxy';
try {
  const asatProxy = await import('./server/asatProxy.mjs');
  handleAsatProxy = asatProxy.handleAsatProxy;
  ASAT_PROXY_PREFIX = asatProxy.ASAT_PROXY_PREFIX;
} catch (error) {
  console.warn('ASAT proxy modülü yüklenemedi:', error instanceof Error ? error.message : error);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envBootstrap = loadMarketPosEnv(__dirname);
if (envBootstrap.loaded) {
  console.log(`Ekolojik env: ${envBootstrap.count} değişken yüklendi (${envBootstrap.path})`);
}
const DIST = join(__dirname, 'dist');
const DATA_DIR = join(__dirname, 'data');
const deliverMessage = createDeliverMessage(DATA_DIR);
const PORT = Number(process.env.PORT || 5180);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveFile(path, res) {
  const data = await readFile(path);
  const ext = extname(path);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (path.endsWith('.user.js')) {
    headers['Content-Type'] = 'application/x-javascript; charset=utf-8';
    headers['Content-Disposition'] = 'inline; filename="market-pos-fatura-kopru.user.js"';
  }
  if (ext === '.html' || ext === '.js' || ext === '.css') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers.Pragma = 'no-cache';
    headers.Expires = '0';
  }
  res.writeHead(200, headers);
  res.end(data);
}

function resolveTenantId(url) {
  const tenant = url.searchParams.get('tenant')?.trim();
  return tenant && tenant !== 'main' ? tenant : 'main';
}

async function readStoreData(tenantId = 'main') {
  const data = await readTenantStore(DATA_DIR, tenantId);
  if (!data?.products?.length) return data;
  const { snapshot, changed } = applyIrsaliyeStockToStoreSnapshot(data);
  if (changed) {
    await writeStoreData(snapshot, tenantId);
  }
  return snapshot;
}

async function writeStoreData(data, tenantId = 'main') {
  await mkdir(DATA_DIR, { recursive: true });
  await writeTenantStore(DATA_DIR, tenantId, data);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

function parseTcmbXml(xml) {
  const rates = [];
  const blocks = xml.match(/<Currency[\s\S]*?<\/Currency>/g) ?? [];
  for (const block of blocks) {
    const code = block.match(/Kod="([^"]+)"/)?.[1] ?? block.match(/CurrencyCode="([^"]+)"/)?.[1];
    if (!code) continue;
    const unit = Number(block.match(/<Unit>([^<]*)<\/Unit>/)?.[1] ?? '1');
    const name = block.match(/<Isim>([^<]*)<\/Isim>/)?.[1] ?? code;
    const buyRate = Number(block.match(/<ForexBuying>([^<]*)<\/ForexBuying>/)?.[1] ?? '0');
    const sellRate = Number(block.match(/<ForexSelling>([^<]*)<\/ForexSelling>/)?.[1] ?? '0');
    if (buyRate <= 0 && sellRate <= 0) continue;
    rates.push({
      code,
      unit: unit > 0 ? unit : 1,
      name,
      buyRate: buyRate > 0 ? buyRate : sellRate,
      sellRate: sellRate > 0 ? sellRate : buyRate,
    });
  }
  const bulletinDate = xml.match(/Tarih="([^"]+)"/)?.[1];
  return { bulletinDate, rates };
}

async function fetchTcmbRates() {
  const response = await fetch(TCMB_URL, {
    headers: { Accept: 'application/xml,text/xml' },
  });
  if (!response.ok) {
    throw new Error(`TCMB HTTP ${response.status}`);
  }
  const xml = await response.text();
  const parsed = parseTcmbXml(xml);
  return {
    fetchedAt: new Date().toISOString(),
    bulletinDate: parsed.bulletinDate,
    rates: parsed.rates,
  };
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).trim();
  let ip = req.socket?.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip || 'unknown';
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/exchange-rates/tcmb' && req.method === 'GET') {
      try {
        const data = await fetchTcmbRates();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'TCMB kurları alınamadı',
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/odeme/prepare' && req.method === 'GET') {
      try {
        const data = await prepareOdemeSession();
        res.writeHead(data.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'odeme.com.tr oturumu başlatılamadı',
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/odeme/query' && req.method === 'POST') {
      const data = await readRequestBody(req);
      const sessionId = data?.sessionId;
      const contractNumber = data?.contractNumber ?? data?.contract ?? data?.aboneNo;
      const turnstileToken = data?.turnstileToken ?? data?.turnstile;
      if (!sessionId || !contractNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Oturum ve abone numarası gerekli' }));
        return;
      }
      try {
        const result = await queryOdemeDebt(sessionId, contractNumber, turnstileToken);
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          contractNumber,
          message: error instanceof Error ? error.message : 'odeme.com.tr sorgusu başarısız',
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/fatura/session' && req.method === 'GET') {
      try {
        const data = await createFaturaSession();
        res.writeHead(data.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'Fatura oturumu başlatılamadı',
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/fatura/query' && req.method === 'POST') {
      const data = await readRequestBody(req);
      const sessionId = data?.sessionId;
      const contractNumber = data?.contractNumber ?? data?.contract;
      const captchaCode = data?.captchaCode ?? data?.captcha;
      if (!sessionId || !contractNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Oturum ve sözleşme numarası gerekli' }));
        return;
      }
      try {
        const result = await queryFaturaDebt(sessionId, contractNumber, captchaCode);
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          contractNumber,
          message: error instanceof Error ? error.message : 'Fatura sorgusu başarısız',
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/asat/diagnostics' && req.method === 'GET') {
      try {
        const data = await probeAsatConnectivity();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          reason: 'NETWORK_UNREACHABLE',
          summary: error instanceof Error ? error.message : 'Tanılama başarısız',
          recommendation: 'Manuel Gir kullanın.',
          checks: [],
        }));
      }
      return;
    }

    if (pathname === '/api/utility-bills/asat' && req.method === 'GET') {
      const contract = (
        url.searchParams.get('contract')
        ?? url.searchParams.get('subscriber')
      )?.trim();
      if (!contract) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Sözleşme numarası gerekli' }));
        return;
      }
      try {
        const data = await fetchAsatDebt(contract);
        res.writeHead(data.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          contractNumber: contract,
          subscriberNumber: contract,
          message: error instanceof Error ? error.message : 'ASAT sorgusu başarısız',
        }));
      }
      return;
    }

    if (pathname === '/api/bill-email/test' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await testBillEmailConnection(data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'E-posta bağlantı testi başarısız',
        }));
      }
      return;
    }

    if (pathname === '/api/bill-email/poll' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await pollBillEmails(DATA_DIR, data ?? {}, resolveTenantId(url));
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'E-posta taraması başarısız',
          processed: 0,
          items: [],
        }));
      }
      return;
    }

    if (pathname === '/api/bill-email/inbox' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const limit = Number(url.searchParams.get('limit') || 50);
      const sourceId = url.searchParams.get('sourceId')?.trim() || undefined;
      try {
        const result = await listBillEmailInbox(DATA_DIR, tenantId, { limit, sourceId });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Inbox listesi alınamadı' }));
      }
      return;
    }

    if (pathname === '/api/system/ekolojik-isolation' && req.method === 'GET') {
      try {
        const report = await getEkolojikIsolationReport(DATA_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, ...report }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Rapor alınamadı' }));
      }
      return;
    }

    if (pathname === '/api/client-ip' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ip: getRequestIp(req) }));
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await registerTenant(DATA_DIR, data ?? {});
        res.writeHead(result.ok ? 201 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'Kayıt başarısız',
        }));
      }
      return;
    }

    if (pathname === '/api/crm/send-email' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await sendCrmEmail(DATA_DIR, {
          to: data?.to,
          subject: data?.subject ?? '',
          body: data?.body ?? '',
          fromName: data?.fromName,
        });
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'E-posta hatası',
        }));
      }
      return;
    }

    if (pathname === '/api/email/health' && req.method === 'GET') {
      const smtp = isEkolojikSmtpConfigured();
      const verify = smtp ? await verifyEkolojikSmtp() : { ok: false, error: 'SMTP yapılandırılmadı' };
      const counts = await getOutboxCounts(DATA_DIR);
      const cfg = getEkolojikMailConfig();
      const effective = await getEffectiveMailPresentation(DATA_DIR);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          smtpConfigured: smtp,
          smtpVerified: verify.ok,
          smtpError: verify.error ?? null,
          smtpHost: cfg.smtpHost || null,
          smtpHostHint: getEkolojikSmtpHostHint(),
          from: cfg.from || null,
          fromName: effective.fromName || null,
          replyTo: effective.replyTo || null,
          opsEmail: effective.opsEmail || null,
          contactAutoreply: isContactAutoreplyEnabled(),
          counts,
        }),
      );
      return;
    }

    const postaTrackMatch = pathname.match(/^\/api\/posta\/track\/open\/([a-f0-9]+)\.gif$/i);
    if (postaTrackMatch && req.method === 'GET') {
      try {
        await recordMailOpen(DATA_DIR, postaTrackMatch[1], { ip: getRequestIp(req) });
        res.writeHead(200, {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        });
        res.end(mailTrackPixelResponse());
      } catch {
        res.writeHead(200, { 'Content-Type': 'image/gif' });
        res.end(mailTrackPixelResponse());
      }
      return;
    }

    if (
      (pathname === '/api/posta/inbox' || pathname === '/api/posta/inbox/search') &&
      req.method === 'GET'
    ) {
      const tenantId = resolveTenantId(url);
      const folder = url.searchParams.get('folder')?.trim() || 'gelen';
      const limit = Number(url.searchParams.get('limit') || 60);
      const q = url.searchParams.get('q')?.trim() || '';
      const listMode = url.searchParams.get('listMode')?.trim() || 'message';
      const unread = url.searchParams.get('unread');
      const starred = url.searchParams.get('starred');
      const hasAttachment = url.searchParams.get('hasAttachment');
      try {
        const result = await listUnifiedPostaInbox(DATA_DIR, tenantId, {
          folder,
          limit,
          q,
          listMode,
          unread,
          starred,
          hasAttachment,
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Inbox hatası' }));
      }
      return;
    }

    const inboxAttachMatch = pathname.match(/^\/api\/posta\/inbox\/([^/]+)\/attachment\/([^/]+)$/);
    if (inboxAttachMatch && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const inboxId = decodeURIComponent(inboxAttachMatch[1]);
      const attachmentId = decodeURIComponent(inboxAttachMatch[2]);
      try {
        const result = await loadPostaInboxAttachment(DATA_DIR, tenantId, inboxId, attachmentId);
        if (!result.ok || !result.data) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(200, {
          'Content-Type': result.meta.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.meta.fileName || 'ek')}"`,
        });
        res.end(result.data);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Ek indirme hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/sent' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const limit = Number(url.searchParams.get('limit') || 80);
      try {
        const result = await listUnifiedPostaSent(DATA_DIR, tenantId, { limit });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Gönderilen hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/sync' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await syncPostaInboxFromImap(DATA_DIR, tenantId);
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'IMAP sync hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/mark-read' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await markPostaInboxRead(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Okundu hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/archive' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await archivePostaInboxItem(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Arşiv hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/storage' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await getPostaStorageSummary(DATA_DIR, tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Depolama hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/batch' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await batchPostaInboxAction(DATA_DIR, tenantId, {
          action: data?.action,
          items: data?.items,
          actor: data?.actor ?? 'pos',
        });
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Toplu işlem hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/mark-all-read' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      const folder = String(data?.folder ?? 'gelen');
      try {
        const result = await markAllPostaInboxReadInFolder(DATA_DIR, tenantId, folder, data?.actor ?? 'pos');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Okundu hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/rules' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await listPostaRules(DATA_DIR, tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kural listesi hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/rules' && req.method === 'PUT') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await savePostaRules(DATA_DIR, tenantId, data?.rules);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kural kayıt hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/outbox/analytics' && req.method === 'GET') {
      const days = Number(url.searchParams.get('days') || 14);
      try {
        const result = await getPostaOutboxAnalytics(DATA_DIR, { days });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Analitik hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/deliverability' && req.method === 'GET') {
      try {
        const result = await getPostaDeliverabilityHub(DATA_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Deliverability hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/compose/rte-capabilities' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getPostaComposeRteCapabilities()));
      return;
    }

    if (pathname === '/api/posta/notifications/matrix' && req.method === 'GET') {
      try {
        const settings = await getPostaMailSettings(DATA_DIR);
        const result = getPostaNotificationsMatrixHub(settings);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Bildirim matrisi hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/compose/ai-suggest' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await suggestPostaCompose({
          subject: data?.subject,
          body: data?.body,
          tone: data?.tone,
        });
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ...result, aiEnabled: isPostaAiEnabled() }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'AI öneri hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/inbox/flags' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      const id = String(data?.id ?? '').trim();
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'id gerekli' }));
        return;
      }
      try {
        const result = await applyPostaInboxFlags(DATA_DIR, tenantId, id, {
          starred: data?.starred,
          spam: data?.spam,
          trashed: data?.trashed,
          snoozedUntil: data?.snoozedUntil,
          labels: data?.labels,
        });
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Bayrak hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/drafts' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await listPostaComposeDrafts(DATA_DIR, tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Taslak listesi hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/drafts' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await upsertPostaComposeDraft(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Taslak kayıt hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/contacts' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const q = url.searchParams.get('q') ?? '';
      const limit = Number(url.searchParams.get('limit') || 120);
      try {
        const result = await listPostaContacts(DATA_DIR, tenantId, { q, limit });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kişi listesi hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/contacts' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await upsertPostaContact(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kişi kayıt hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/contacts/import' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      const format = String(data?.format ?? 'vcf').toLowerCase();
      const text = String(data?.text ?? '');
      try {
        const rows = format === 'csv' ? parseCsvContactsImport(text) : parseVcardImport(text);
        const result = await importPostaContacts(DATA_DIR, tenantId, rows);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'İçe aktarma hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/contacts/export.vcf' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const listed = await listPostaContacts(DATA_DIR, tenantId, { limit: 500 });
        const body = contactsToVcard(listed.contacts ?? []);
        res.writeHead(200, {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': 'attachment; filename="ekolojik-posta-contacts.vcf"',
        });
        res.end(body);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Dışa aktarma hatası' }));
      }
      return;
    }

    const contactDeleteMatch = pathname.match(/^\/api\/posta\/contacts\/([^/]+)$/);
    if (contactDeleteMatch && req.method === 'DELETE') {
      const tenantId = resolveTenantId(url);
      const contactId = decodeURIComponent(contactDeleteMatch[1]);
      try {
        const result = await deletePostaContact(DATA_DIR, tenantId, contactId);
        res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kişi silme hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/calendar' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const limit = Number(url.searchParams.get('limit') || 120);
      try {
        const result = await listPostaCalendar(DATA_DIR, tenantId, { limit });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Takvim hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/calendar' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await upsertPostaCalendarEvent(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Takvim kayıt hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/calendar/sync-payments' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await syncPaymentRemindersSnapshot(DATA_DIR, tenantId, data?.reminders ?? []);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Ödeme senkron hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/calendar/from-mail' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await createCalendarEventFromMail(DATA_DIR, tenantId, data ?? {});
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Takvim mail hatası' }));
      }
      return;
    }

    const calendarDeleteMatch = pathname.match(/^\/api\/posta\/calendar\/([^/]+)$/);
    if (calendarDeleteMatch && req.method === 'DELETE') {
      const tenantId = resolveTenantId(url);
      const eventId = decodeURIComponent(calendarDeleteMatch[1]);
      try {
        const result = await deletePostaCalendarEvent(DATA_DIR, tenantId, eventId);
        res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Takvim silme hatası' }));
      }
      return;
    }

    const draftDeleteMatch = pathname.match(/^\/api\/posta\/drafts\/([^/]+)$/);
    if (draftDeleteMatch && req.method === 'DELETE') {
      const tenantId = resolveTenantId(url);
      const draftId = decodeURIComponent(draftDeleteMatch[1]);
      try {
        const result = await deletePostaComposeDraft(DATA_DIR, tenantId, draftId);
        res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Taslak silme hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/unread-counts' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await getPostaUnreadCounts(DATA_DIR, tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Sayaç hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/events' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      const push = async () => {
        try {
          const payload = await getPostaUnreadCounts(DATA_DIR, tenantId);
          res.write(`event: unread\ndata: ${JSON.stringify(payload)}\n\n`);
        } catch (error) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'SSE hatası' })}\n\n`,
          );
        }
      };
      await push();
      const timer = setInterval(() => {
        void push();
      }, 15000);
      req.on('close', () => clearInterval(timer));
      return;
    }

    if (pathname === '/api/posta/templates' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, templates: listMailTemplates() }));
      return;
    }

    if (pathname === '/api/posta/compose-hints' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 40);
      try {
        const hints = await getComposeRecipientHints(DATA_DIR, { limit });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(hints));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'İpucu hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/imap/health' && req.method === 'GET') {
      if (!isEkolojikImapConfigured()) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, imapConfigured: false, imapVerified: false }));
        return;
      }
      const cfg = getEkolojikImapConfig();
      try {
        const verify = await verifyImapMailbox(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: true,
            imapConfigured: true,
            imapVerified: verify.ok,
            imapHost: cfg.imapHost,
            imapUser: cfg.imapUser,
            mailboxCount: verify.mailboxCount ?? null,
            unseenCount: verify.unseenCount ?? null,
            message: verify.message ?? null,
          }),
        );
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: true,
            imapConfigured: true,
            imapVerified: false,
            imapHost: cfg.imapHost,
            imapUser: cfg.imapUser,
            error: error instanceof Error ? error.message : 'IMAP hatası',
          }),
        );
      }
      return;
    }

    if (pathname === '/api/posta/settings' && req.method === 'GET') {
      try {
        const settings = await getPostaMailSettings(DATA_DIR);
        const effective = await getEffectiveMailPresentation(DATA_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, settings, effective }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Ayar hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/settings' && req.method === 'PUT') {
      const data = await readRequestBody(req);
      try {
        const result = await savePostaMailSettings(DATA_DIR, data ?? {});
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Kayıt hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/export/outbox.csv' && req.method === 'GET') {
      const from = url.searchParams.get('from')?.trim() || undefined;
      const to = url.searchParams.get('to')?.trim() || undefined;
      try {
        const result = await buildOutboxCsv(DATA_DIR, { from, to });
        if (!result.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="ekolojik-outbox.csv"',
        });
        res.end(`\ufeff${result.csv}`);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Export hatası' }));
      }
      return;
    }

    if (pathname === '/api/posta/export/contact.csv' && req.method === 'GET') {
      const from = url.searchParams.get('from')?.trim() || undefined;
      const to = url.searchParams.get('to')?.trim() || undefined;
      try {
        const result = await buildContactCsv(DATA_DIR, { from, to });
        if (!result.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="ekolojik-contact.csv"',
        });
        res.end(`\ufeff${result.csv}`);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Export hatası' }));
      }
      return;
    }

    if (pathname === '/api/email/outbox/retry' && req.method === 'POST') {
      const data = await readRequestBody(req);
      const id = data?.id?.trim();
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Outbox id gerekli' }));
        return;
      }
      try {
        const requeued = await requeueFailedOutboxMessage(DATA_DIR, id);
        if (!requeued.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(requeued));
          return;
        }
        const run = await processPendingOutbox(DATA_DIR, deliverMessage, { limit: 10 });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, requeued: true, processed: run }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Retry hatası' }));
      }
      return;
    }

    if (pathname.startsWith('/api/email/outbox/') && req.method === 'GET') {
      const parts = pathname.split('/').filter(Boolean);
      const outboxId = parts[3];
      if (outboxId && outboxId !== 'recent' && outboxId !== 'process' && outboxId !== 'retry') {
        const hit = await findOutboxMessageById(DATA_DIR, decodeURIComponent(outboxId));
        if (!hit) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'Kayıt bulunamadı' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, folder: hit.folder, message: hit.message }));
        return;
      }
    }

    if (pathname === '/api/email/outbox/recent' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 30);
      const recent = await listRecentOutbox(DATA_DIR, limit);
      const items = await listMergedRecentOutbox(DATA_DIR, limit);
      const counts = await getOutboxCounts(DATA_DIR);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, counts, items, ...recent }));
      return;
    }

    if (pathname === '/api/email/test' && req.method === 'POST') {
      const data = await readRequestBody(req);
      const to = data?.to?.trim();
      if (!to?.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Geçerli to e-posta gerekli' }));
        return;
      }
      try {
        const attachCheck = validateOutboundAttachments(data?.attachments);
        if (!attachCheck.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: attachCheck.error }));
          return;
        }
        const bodyRaw = data?.body?.trim() || 'Bu mesaj Ekolojik Market bağımsız posta outbox (Faz 1) testidir.';
        const htmlSanitized = data?.html ? sanitizePostaComposeHtml(data.html) : '';
        const formatted = htmlSanitized
          ? { text: stripHtmlToPlainText(htmlSanitized) || bodyRaw, html: htmlSanitized }
          : formatPostaComposeBody(bodyRaw);
        const result = await sendEkolojikMail(DATA_DIR, {
          to,
          cc: data?.cc?.trim() || undefined,
          bcc: data?.bcc?.trim() || undefined,
          subject: data?.subject?.trim() || 'Ekolojik Market — SMTP test',
          body: formatted.text,
          html: formatted.html,
          fromName: data?.fromName,
          idempotencyKey: `test:${to}:${Date.now()}`,
          source: 'posta-compose',
          inReplyTo: data?.inReplyTo?.trim() || undefined,
          references: data?.references?.trim() || undefined,
          attachments: attachCheck.attachments,
        });
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Test hatası' }));
      }
      return;
    }

    if (pathname === '/api/email/outbox/process' && req.method === 'POST') {
      try {
        const run = await processPendingOutbox(DATA_DIR, deliverMessage, { limit: 30 });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, ...run }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'İşlem hatası' }));
      }
      return;
    }

    if (pathname === '/api/messaging/export' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      try {
        const result = await buildMessagingExportZip(DATA_DIR, tenantId);
        if (!result.ok) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
          return;
        }
        const contentType = result.fallback ? 'application/json; charset=utf-8' : 'application/zip';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        });
        res.end(result.buffer);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Export hatası' }));
      }
      return;
    }

    if (pathname === '/api/messaging/threads' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const customerId = url.searchParams.get('customerId')?.trim() || undefined;
      const limit = Number(url.searchParams.get('limit') || 50);
      const q = url.searchParams.get('q')?.trim() || undefined;
      const includeArchived = url.searchParams.get('includeArchived') === '1';
      try {
        const result = await listMessagingThreads(DATA_DIR, tenantId, { limit, customerId, q, includeArchived });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Liste hatası' }));
      }
      return;
    }

    if (pathname === '/api/messaging/threads' && req.method === 'POST') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      try {
        const result = await createMessagingThread(DATA_DIR, tenantId, data ?? {});
        if (result.ok && result.message) {
          try {
            result.notifications = await notifyOnMessagingMessage(DATA_DIR, {
              thread: result.thread,
              message: result.message,
            });
          } catch (notifyError) {
            result.notifications = {
              ok: false,
              error: notifyError instanceof Error ? notifyError.message : 'Bildirim hatası',
            };
          }
        }
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Oluşturma hatası' }));
      }
      return;
    }

    if (pathname.startsWith('/api/messaging/threads/')) {
      const parts = pathname.split('/').filter(Boolean);
      const threadId = parts[3];
      const sub = parts[4];
      const tenantId = resolveTenantId(url);

      if (sub === 'read' && threadId && req.method === 'POST') {
        try {
          const result = await markMessagingThreadStaffRead(DATA_DIR, tenantId, threadId);
          res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Okundu hatası' }));
        }
        return;
      }

      if (sub === 'flags' && threadId && req.method === 'POST') {
        const data = await readRequestBody(req);
        try {
          const result = await patchMessagingThread(DATA_DIR, tenantId, threadId, {
            pinned: data?.pinned,
            archived: data?.archived,
            muted: data?.muted,
          });
          res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Bayrak hatası' }));
        }
        return;
      }

      if (sub === 'messages' && threadId && req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 100);
        const q = url.searchParams.get('q')?.trim() || undefined;
        try {
          const result = q
            ? await searchMessagingInThread(DATA_DIR, tenantId, threadId, q, { limit })
            : await listMessagingMessages(DATA_DIR, tenantId, threadId, { limit });
          res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Mesaj listesi hatası' }));
        }
        return;
      }

      if (sub === 'messages' && threadId && req.method === 'POST') {
        const data = await readRequestBody(req);
        try {
          const result = await appendMessagingMessage(DATA_DIR, tenantId, threadId, data ?? {});
          if (result.ok && result.message) {
            try {
              result.notifications = await notifyOnMessagingMessage(DATA_DIR, {
                thread: result.thread,
                message: result.message,
              });
            } catch (notifyError) {
              result.notifications = {
                ok: false,
                error: notifyError instanceof Error ? notifyError.message : 'Bildirim hatası',
              };
            }
          }
          res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Gönderim hatası' }));
        }
        return;
      }

      if (!sub && threadId && req.method === 'GET') {
        try {
          const result = await getMessagingThread(DATA_DIR, tenantId, threadId);
          res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Thread hatası' }));
        }
        return;
      }
    }

    if (pathname.startsWith('/api/messaging/attachments/') && req.method === 'GET') {
      const parts = pathname.split('/').filter(Boolean);
      const attachmentId = decodeURIComponent(parts[3] ?? '');
      const tenantId = resolveTenantId(url);
      try {
        const file = await readMessagingAttachment(DATA_DIR, tenantId, attachmentId);
        if (!file.ok) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(file));
          return;
        }
        res.writeHead(200, {
          'Content-Type': file.mimeType,
          'Content-Length': file.size,
          'Content-Disposition': `inline; filename="${file.fileName.replace(/"/g, '')}"`,
        });
        res.end(file.data);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Ek okunamadı' }));
      }
      return;
    }

    if (pathname === '/api/system/data-retention/policy' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, policy: getRetentionPolicySummary() }));
      return;
    }

    if (pathname === '/api/system/data-retention/run' && req.method === 'POST') {
      try {
        const tenantId = resolveTenantId(url);
        const result = await runEkolojikDataRetention(DATA_DIR, tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Retention hatası' }));
      }
      return;
    }

    if (pathname === '/api/lerta/messaging/threads' && req.method === 'GET') {
      if (!isLertaPlatformConfigured()) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Lerta messaging yapılandırılmadı' }));
        return;
      }
      const limit = url.searchParams.get('limit') ?? '50';
      const result = await listLertaMessagingThreads({ limit: Number(limit) || 50 });
      res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname.startsWith('/api/lerta/messaging/threads/') && req.method === 'POST') {
      const parts = pathname.split('/').filter(Boolean);
      const threadId = parts[4];
      const action = parts[5];
      if (action === 'messages' && threadId) {
        if (!isLertaPlatformConfigured()) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'Lerta messaging yapılandırılmadı' }));
          return;
        }
        const data = await readRequestBody(req);
        const result = await sendLertaMessagingMessage({
          threadId,
          bodyText: data?.bodyText ?? data?.body ?? '',
          locale: data?.locale ?? 'tr',
        });
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        return;
      }
    }

    if (pathname === '/api/contact/messages' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 50);
      try {
        const messages = await listContactMessages(DATA_DIR, limit);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, messages }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Liste alınamadı' }));
      }
      return;
    }

    if (pathname === '/api/contact' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await saveContactMessage(DATA_DIR, data ?? {});
        if (result.ok && result.contact) {
          try {
            result.notifications = await sendContactNotifications(DATA_DIR, result.contact);
          } catch (mailError) {
            result.notifications = {
              ok: false,
              error: mailError instanceof Error ? mailError.message : 'Posta kuyruğu hatası',
            };
          }
          delete result.contact;
        }
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Mesaj kaydedilemedi' }));
      }
      return;
    }

    if (pathname === '/api/data' && req.method === 'GET') {
      const tenantId = resolveTenantId(url);
      const data = await readStoreData(tenantId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data ?? {}));
      return;
    }

    if (pathname === '/api/data' && req.method === 'PUT') {
      const tenantId = resolveTenantId(url);
      const data = await readRequestBody(req);
      if (!data || typeof data !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Geçersiz veri' }));
        return;
      }
      const existing = await readTenantStore(DATA_DIR, tenantId);
      if (existing && typeof existing === 'object') {
        if (!Array.isArray(data.products) && Array.isArray(existing.products)) {
          data.products = existing.products;
        }
        if (!Array.isArray(data.sales) && Array.isArray(existing.sales)) {
          data.sales = existing.sales;
        }
        if (!Array.isArray(data.customers) && Array.isArray(existing.customers)) {
          data.customers = existing.customers;
        }
        if (data.settings == null && existing.settings) {
          data.settings = existing.settings;
        }
      }
      data.updatedAt = data.updatedAt || new Date().toISOString();
      const { snapshot: stockFixed, changed } = applyIrsaliyeStockToStoreSnapshot(data);
      const toSave = changed ? stockFixed : data;
      await writeStoreData(toSave, tenantId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updatedAt: toSave.updatedAt }));
      return;
    }

    if (pathname.startsWith(ASAT_PROXY_PREFIX)) {
      if (!handleAsatProxy) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ASAT proxy modülü yüklü değil');
        return;
      }
      try {
        await handleAsatProxy(req, res, pathname, url.search, ASAT_PROXY_PREFIX);
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(error instanceof Error ? error.message : 'ASAT proxy hatası');
      }
      return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = join(DIST, pathname);
    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat?.isFile()) {
      await serveFile(filePath, res);
      return;
    }

    await serveFile(join(DIST, 'index.html'), res);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sunucu hatası');
  }
});

const OUTBOX_DRAIN_MS = 30_000;
setInterval(() => {
  if (!isEkolojikSmtpConfigured()) return;
  processPendingOutbox(DATA_DIR, deliverMessage, { limit: 15 }).catch((error) => {
    console.warn('email-outbox drain:', error instanceof Error ? error.message : error);
  });
}, OUTBOX_DRAIN_MS);

const RETENTION_MS = 24 * 60 * 60 * 1000;
const runRetention = () => {
  runEkolojikDataRetention(DATA_DIR, 'main').then((result) => {
    const r = result.removed;
    const total = (r.outboxSentFailed ?? 0) + (r.messagingAttachments ?? 0) + (r.contactMessages ?? 0);
    if (total > 0) {
      console.log('data-retention:', JSON.stringify(r));
    }
  }).catch((error) => {
    console.warn('data-retention:', error instanceof Error ? error.message : error);
  });
};
setTimeout(runRetention, 60_000);
setInterval(runRetention, RETENTION_MS);

server.listen(PORT, HOST, () => {
  console.log(`Market POS → http://${HOST}:${PORT}`);
  if (isEkolojikSmtpConfigured()) {
    console.log('Ekolojik mail outbox: SMTP aktif, kuyruk drain 30s');
  } else {
    console.log('Ekolojik mail outbox: SMTP yok — EKOLOJIK_SMTP_* tanımlayın');
  }
});
