import { randomUUID } from 'node:crypto';

const BASE_URL = 'https://odeme.com.tr/fatura/su/ANTALYASU';
const QUERY_URL = 'https://odeme.com.tr/faturasorgulama';
const REQUEST_TIMEOUT_MS = 30000;
const SESSION_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { cookies: string, csrf: string, createdAt: number }>} */
const sessions = new Map();

function collectSetCookie(headers) {
  if (!headers) return '';
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  }
  const raw = headers.get?.('set-cookie');
  return raw ? raw.split(/,(?=[^;]+?=)/).map((item) => item.split(';')[0]).join('; ') : '';
}

function parseTurkishAmount(raw) {
  if (raw == null) return 0;
  const cleaned = String(raw)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function parseTurkishDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const dotted = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month}-${day}`;
  }
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

async function fetchPage(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      ...options.headers,
    },
  });
  const text = await response.text();
  return {
    response,
    text,
    cookies: collectSetCookie(response.headers),
  };
}

function extractCsrf(html) {
  return html.match(/name="csrf-token"\s+content="([^"]+)"/i)?.[1] ?? '';
}

function parseDebtResponse(payload) {
  const content = payload?.success?.Content;
  if (!Array.isArray(content) || content.length === 0) return [];

  return content.map((item) => ({
    invoiceNo: item.FaturaNo || '',
    dueDate: parseTurkishDate(item.SonOdeme) || null,
    amount: item.Tutar,
    description: item.Aciklama || '',
    subscriberName: item.AboneAdi || '',
    balance: parseTurkishAmount(item.Tutar),
  })).filter((item) => item.balance > 0 || item.dueDate);
}

export async function prepareOdemeSession() {
  cleanupSessions();
  const landing = await fetchPage(BASE_URL, { redirect: 'follow' });
  const csrf = extractCsrf(landing.text);
  if (!csrf) {
    return { ok: false, message: 'odeme.com.tr oturumu başlatılamadı' };
  }

  const sessionId = randomUUID();
  sessions.set(sessionId, {
    cookies: landing.cookies,
    csrf,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    sessionId,
    turnstileSiteKey: '0x4AAAAAACMzwN4te27H7IVZ',
    provider: 'odemecomtr',
    kvkkAccepted: true,
    message: 'Güvenlik doğrulaması hazır',
  };
}

export async function queryOdemeDebt(sessionId, contractNumber, turnstileToken) {
  cleanupSessions();
  const session = sessions.get(sessionId);
  if (!session) {
    return { ok: false, message: 'Oturum süresi doldu. Yeniden deneyin.' };
  }

  const contract = String(contractNumber ?? '').trim();
  if (!contract) {
    return { ok: false, message: 'Abone / sözleşme numarası gerekli' };
  }
  if (!turnstileToken || !String(turnstileToken).trim()) {
    return { ok: false, message: 'Güvenlik doğrulaması gerekli' };
  }

  const body = new URLSearchParams({
    abone_no: contract,
    sorgu_tipi: 'AboneNo',
    kurum: 'ANTALYASU',
    kurum_no: '2006',
    referans_no: '',
    faturaTipi: 'su',
    flag: `${session.csrf}445512`,
    browserid: 'marketpos-auto',
  });

  const result = await fetchPage(QUERY_URL, {
    method: 'POST',
    headers: {
      Cookie: session.cookies,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://odeme.com.tr',
      Referer: BASE_URL,
      'X-CSRF-Token': session.csrf,
      'X-Turnstile-Token': String(turnstileToken).trim(),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });

  let payload;
  try {
    payload = JSON.parse(result.text);
  } catch {
    return {
      ok: false,
      contractNumber: contract,
      message: 'odeme.com.tr yanıtı okunamadı',
      provider: 'odemecomtr',
    };
  }

  if (payload.error === 'security_failed') {
    return {
      ok: false,
      contractNumber: contract,
      message: payload.message || 'Güvenlik doğrulaması başarısız',
      provider: 'odemecomtr',
      needsTurnstile: true,
    };
  }

  if (payload.error) {
    return {
      ok: false,
      contractNumber: contract,
      message: payload.message || String(payload.error),
      provider: 'odemecomtr',
    };
  }

  const debts = parseDebtResponse(payload);
  if (debts.length === 0) {
    const message = payload?.success?.Message || 'Kayıt bulunamadı veya borç yok';
    return {
      ok: false,
      contractNumber: contract,
      message,
      provider: 'odemecomtr',
      noDebt: /borç|kayıt|bulunamad/i.test(message),
    };
  }

  const earliest = debts.reduce((best, item) => {
    if (!item.dueDate) return best;
    if (!best?.dueDate || item.dueDate < best.dueDate) return item;
    return best;
  }, debts[0]);

  const totalBalance = debts.reduce((sum, item) => sum + (item.balance || 0), 0);

  return {
    ok: true,
    contractNumber: contract,
    balance: totalBalance > 0 ? totalBalance : earliest.balance,
    dueDate: earliest.dueDate,
    subscriberName: earliest.subscriberName,
    debts,
    provider: 'odemecomtr',
    message: 'Borç bilgisi alındı',
  };
}
