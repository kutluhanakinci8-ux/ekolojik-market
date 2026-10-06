import { randomUUID } from 'node:crypto';

const BASE_URL = 'https://www.faturaodemelisin.com/antalya-su-asat-faturasi-odeme-sorgulama';
const ORIGIN = 'https://www.faturaodemelisin.com';
const REQUEST_TIMEOUT_MS = 30000;
const SESSION_TTL_MS = 10 * 60 * 1000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @type {Map<string, { cookies: string, fields: Record<string,string>, createdAt: number }>} */
const sessions = new Map();

function collectSetCookie(headers) {
  if (!headers) return '';
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  }
  const raw = headers.get?.('set-cookie');
  return raw ? raw.split(/,(?=[^;]+?=)/).map((item) => item.split(';')[0]).join('; ') : '';
}

function mergeCookies(...chunks) {
  const jar = new Map();
  for (const chunk of chunks) {
    if (!chunk) continue;
    for (const pair of chunk.split(';')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      jar.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
    }
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
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

function extractHiddenFields(html) {
  const fields = {};
  const inputs = html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi);
  for (const input of inputs) {
    const tag = input[0];
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = tag.match(/value=["']([^"']*)["']/i)?.[1] ?? '';
    fields[name] = value;
  }
  return fields;
}

function extractCaptchaPath(html) {
  const match = html.match(/src=["'](\/GuvenlikResmi\.aspx[^"']*)["']/i);
  if (!match) return null;
  return match[1].replace(/ /g, '%20');
}

function extractError(html) {
  const hata = html.match(/id=["']HATA["'][^>]*>([^<]+)/i)?.[1]?.trim();
  if (hata) return hata;
  const yHata = html.match(/id=["']ContentPlaceHolder1_YHata["'][^>]*value=["']([^"']*)["']/i)?.[1]?.trim();
  if (yHata) return yHata;
  if (/Güvenlik Kodunu Hatalı|Güvenlik kodu hatalı/i.test(html)) return 'Güvenlik kodu hatalı';
  if (/Güvenlik Kodunu Girmediniz|Güvenlik Kodunu Giriniz/i.test(html)) return 'Güvenlik kodu gerekli';
  if (/Kayıt bulunamadı|borç bulunamadı|borc bulunamadi/i.test(html)) return 'Kayıt bulunamadı';
  return null;
}

function isExplicitCaptchaError(html) {
  return /Güvenlik Kodunu Hatalı|Güvenlik kodu hatalı|Güvenlik Kodunu Girmediniz|Güvenlik Kodunu Giriniz/i.test(html);
}

function hasEmptyDebtTab(html) {
  return /<div id=["']ContentPlaceHolder1_tab["']>\s*<\/div>/i.test(html);
}

function hasDebtTable(html) {
  return /id=["']ContentPlaceHolder1_tab["'][\s\S]*?<table/i.test(html);
}

function requiresTurnstile(html) {
  return /cf-turnstile|cf-turnstile-response|turnstileHazirOldu/i.test(html);
}

function parseDebtTable(html) {
  const tableCandidates = [];
  const scoped = html.match(/id=["']ContentPlaceHolder1_tab["'][\s\S]*?<table[\s\S]*?<\/table>/i);
  if (scoped) tableCandidates.push(scoped[0]);
  const allTables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const table of allTables) {
    if (/Son\s*Ödeme|Taksit|Tutar|Gecikme/i.test(table)) {
      tableCandidates.push(table);
    }
  }

  const debts = [];
  const seen = new Set();

  for (const tableHtml of tableCandidates) {
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => cell[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (cells.length < 2) continue;
      if (cells.some((cell) => /Son\s*Ödeme|Taksit|Tutar|Açıklama|Gecikme/i.test(cell))) continue;

      const dueDate = parseTurkishDate(cells[0]) || parseTurkishDate(cells.find((c) => parseTurkishDate(c)) || '');
      const amountText = cells[4] || cells[2] || cells.find((c) => /[\d,.]+\s*₺?/.test(c)) || cells[cells.length - 1];
      const balance = parseTurkishAmount(amountText);
      if (!dueDate && balance <= 0) continue;

      const key = `${dueDate}|${balance}|${cells.join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);

      debts.push({
        dueDate: dueDate || null,
        installment: cells[1] || '',
        amount: cells[2] || '',
        delayAmount: cells[3] || '',
        totalAmount: cells[4] || amountText,
        description: cells[5] || '',
        balance,
      });
    }
  }

  return debts;
}

async function fetchPage(url, options = {}) {
  const requestCookies = options.cookieJar ?? '';
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      ...(requestCookies ? { Cookie: requestCookies } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const responseCookies = collectSetCookie(response.headers);
  const cookieJar = mergeCookies(requestCookies, responseCookies);
  return {
    response,
    text,
    cookies: responseCookies,
    cookieJar,
  };
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export async function createFaturaSession() {
  cleanupSessions();
  const landing = await fetchPage(BASE_URL, { redirect: 'follow' });
  const fields = extractHiddenFields(landing.text);
  const captchaPath = extractCaptchaPath(landing.text);
  if (!captchaPath) {
    return { ok: false, message: 'Güvenlik resmi alınamadı' };
  }

  let cookieJar = landing.cookieJar;
  const captchaRes = await fetch(`${ORIGIN}${captchaPath}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Cookie: cookieJar,
      'User-Agent': USER_AGENT,
      Referer: BASE_URL,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  cookieJar = mergeCookies(cookieJar, collectSetCookie(captchaRes.headers));
  const captchaBuffer = Buffer.from(await captchaRes.arrayBuffer());

  const sessionId = randomUUID();
  sessions.set(sessionId, {
    cookies: cookieJar,
    fields,
    turnstileHint: landing.text,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    sessionId,
    captchaImage: `data:image/png;base64,${captchaBuffer.toString('base64')}`,
    provider: 'faturaodemelisin',
    turnstileRequired: requiresTurnstile(landing.text),
    message: requiresTurnstile(landing.text)
      ? 'Sunucu sorgusu devre dışı — kart içindeki faturaodemelisin formunu kullanın.'
      : undefined,
  };
}

export async function queryFaturaDebt(sessionId, contractNumber, captchaCode) {
  cleanupSessions();
  const session = sessions.get(sessionId);
  if (!session) {
    return { ok: false, message: 'Oturum süresi doldu. Kodu Yenile ile yeni resim alın.' };
  }

  const contract = String(contractNumber ?? '').trim();
  if (!contract) {
    return { ok: false, message: 'Abone / sözleşme numarası gerekli' };
  }
  const code = String(captchaCode ?? '').trim();
  if (!code) {
    return { ok: false, message: 'Güvenlik kodu gerekli' };
  }

  const body = new URLSearchParams({
    ...session.fields,
    'ctl00$ContentPlaceHolder1$TextBox1': contract,
    'ctl00$ContentPlaceHolder1$TextBox5': code,
    'ctl00$ContentPlaceHolder1$Button1': 'Sorgula',
  });

  const result = await fetchPage(BASE_URL, {
    method: 'POST',
    cookieJar: session.cookies,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: ORIGIN,
      Referer: BASE_URL,
    },
    body,
  });

  sessions.delete(sessionId);

  const error = extractError(result.text);
  const debts = parseDebtTable(result.text);
  if (debts.length > 0) {
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
      debts,
      provider: 'faturaodemelisin',
      message: 'Borç bilgisi alındı',
    };
  }

  if (/Kayıt bulunamadı|borç bulunamadı|borc bulunamadi/i.test(error || '')) {
    return {
      ok: true,
      contractNumber: contract,
      balance: 0,
      noDebt: true,
      provider: 'faturaodemelisin',
      message: 'Borç bulunamadı',
    };
  }

  if (isExplicitCaptchaError(result.text)) {
    return {
      ok: false,
      contractNumber: contract,
      message: 'Güvenlik kodu hatalı — resimdeki harfleri aynen yazın ve Kodu Yenile ile tekrar deneyin',
      provider: 'faturaodemelisin',
      captchaError: true,
    };
  }

  if (hasEmptyDebtTab(result.text) && !hasDebtTable(result.text)) {
    const turnstileRequired = requiresTurnstile(result.text) || requiresTurnstile(session.turnstileHint || '');
    return {
      ok: false,
      contractNumber: contract,
      message: turnstileRequired
        ? 'faturaodemelisin artık Cloudflare Turnstile istiyor — kart içindeki gömülü formu kullanın (sunucu sorgusu desteklenmiyor).'
        : 'Sorgu yanıt vermedi. Güvenlik kodunun süresi dolmuş olabilir — Kodu Yenile, yeni kodu yazın.',
      provider: 'faturaodemelisin',
      captchaError: !turnstileRequired,
      turnstileRequired,
    };
  }

  return {
    ok: false,
    contractNumber: contract,
    message: error || 'Sorgu sonucu okunamadı',
    provider: 'faturaodemelisin',
  };
}
