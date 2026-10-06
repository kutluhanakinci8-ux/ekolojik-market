const ASAT_ONLINE_BASE = 'https://online.asat.gov.tr';
const ASAT_MAIN_SITE = 'https://www.asat.gov.tr';
const ASAT_DEBT_PAGE = `${ASAT_ONLINE_BASE}/odenmemisBorclarAnonym`;
const ASAT_LOGIN_PAGE = `${ASAT_ONLINE_BASE}/loginAnonym`;
const REQUEST_TIMEOUT_MS = 25000;
const PROBE_TIMEOUT_MS = 12000;

function normalizeContractNumber(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/[^0-9A-Za-z]/g, '').replace(/V$/i, '');
}

function parseTurkishAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
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
  if (iso) return iso[0];
  return null;
}

function extractFromJson(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.data
      ?? payload?.result
      ?? payload?.items
      ?? payload?.borclar
      ?? payload?.debts
      ?? [];

  const rows = Array.isArray(list) ? list : [payload];
  let totalBalance = 0;
  let earliestDueDate = null;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const amount = parseTurkishAmount(
      row.gecikmeliTutar
      ?? row.GecikmeliTutar
      ?? row.tutar
      ?? row.Tutar
      ?? row.balance
      ?? row.borc,
    );
    const dueDate = parseTurkishDate(
      row.sonOdemeTarihi
      ?? row.SonOdemeTarihi
      ?? row.dueDate
      ?? row.vadeTarihi,
    );
    if (amount != null) totalBalance += amount;
    if (dueDate && (!earliestDueDate || dueDate < earliestDueDate)) {
      earliestDueDate = dueDate;
    }
  }

  if (totalBalance > 0 || earliestDueDate) {
    return { balance: totalBalance, dueDate: earliestDueDate };
  }

  const single = rows[0];
  if (!single || typeof single !== 'object') return null;
  const balance = parseTurkishAmount(
    single.gecikmeliTutar
    ?? single.GecikmeliTutar
    ?? single.tutar
    ?? single.Tutar
    ?? single.toplamBorc
    ?? single.ToplamBorc,
  );
  const dueDate = parseTurkishDate(
    single.sonOdemeTarihi
    ?? single.SonOdemeTarihi
    ?? single.dueDate,
  );
  if (balance == null && !dueDate) return null;
  return { balance, dueDate };
}

function extractFromDebtTable(html) {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch = rowPattern.exec(html);
  while (rowMatch) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cell[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length >= 3) rows.push(cells);
    rowMatch = rowPattern.exec(html);
  }

  let totalBalance = 0;
  let earliestDueDate = null;

  for (const cells of rows) {
    const joined = cells.join(' ');
    if (/kayıt bulunamadı|toplam/i.test(joined)) continue;

    const dueDate = cells.map(parseTurkishDate).find(Boolean) ?? parseTurkishDate(joined);
    const amounts = cells
      .map(parseTurkishAmount)
      .filter((value) => value != null && value > 0);
    const balance = amounts.length > 0 ? amounts[amounts.length - 1] : null;

    if (!dueDate && balance == null) continue;
    if (balance != null) totalBalance += balance;
    if (dueDate && (!earliestDueDate || dueDate < earliestDueDate)) {
      earliestDueDate = dueDate;
    }
  }

  if (totalBalance > 0 || earliestDueDate) {
    return { balance: totalBalance, dueDate: earliestDueDate };
  }
  return null;
}

function extractFromHtml(html) {
  if (/recaptcha|captcha|robot değilim/i.test(html) && !/gecikmeli tutar|son ödeme tarihi/i.test(html)) {
    return { captchaRequired: true };
  }

  const tableResult = extractFromDebtTable(html);
  if (tableResult) return tableResult;

  const compact = html.replace(/\s+/g, ' ');
  const amountMatch = compact.match(/(?:gecikmeli\s*tutar|ödenecek\s*tutar|toplam\s*borç)[^0-9]{0,24}(\d[\d.,]*)/i);
  const dateMatch = compact.match(/(?:son\s*ödeme\s*tarihi)[^0-9]{0,24}(\d{2}[./-]\d{2}[./-]\d{4})/i);
  const balance = amountMatch ? parseTurkishAmount(amountMatch[1]) : null;
  const dueDate = dateMatch ? parseTurkishDate(dateMatch[1]) : null;
  if (balance == null && !dueDate) return null;
  return { balance, dueDate };
}

function collectSetCookie(headers) {
  if (!headers) return '';
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  }
  const raw = headers.get?.('set-cookie');
  return raw ? raw.split(/,(?=[^;]+?=)/).map((item) => item.split(';')[0]).join('; ') : '';
}

async function tryFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/html, */*',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      Origin: ASAT_ONLINE_BASE,
      Referer: ASAT_DEBT_PAGE,
      ...options.headers,
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  return { response, contentType, text, cookies: collectSetCookie(response.headers) };
}

function buildContractBodies(contractNumber) {
  return [
    new URLSearchParams({ sozlesmeNo: contractNumber }),
    new URLSearchParams({ SozlesmeNo: contractNumber }),
    new URLSearchParams({ contractNumber }),
    new URLSearchParams({ muhatapNo: contractNumber }),
    new URLSearchParams({ MuhatapNo: contractNumber }),
    new URLSearchParams({ aboneNo: contractNumber }),
    new URLSearchParams({ query: contractNumber }),
    JSON.stringify({ sozlesmeNo: contractNumber }),
    JSON.stringify({ contractNumber }),
    JSON.stringify({ muhatapNo: contractNumber }),
  ];
}

async function queryAsatPortal(contractNumber) {
  const attempts = [];

  const landing = await tryFetch(ASAT_DEBT_PAGE, { redirect: 'follow' });
  attempts.push({ step: 'odenmemisBorclarAnonym', status: landing.response.status });
  let cookie = landing.cookies;

  if (landing.response.status >= 400) {
    const loginLanding = await tryFetch(ASAT_LOGIN_PAGE, { redirect: 'follow' });
    attempts.push({ step: 'loginAnonym', status: loginLanding.response.status });
    cookie = loginLanding.cookies || cookie;
  }

  const postUrls = [
    `${ASAT_ONLINE_BASE}/odenmemisBorclarAnonym/sorgula`,
    `${ASAT_ONLINE_BASE}/odenmemisBorclarAnonym/Sorgula`,
    `${ASAT_ONLINE_BASE}/api/odenmemisBorclar/list`,
    `${ASAT_ONLINE_BASE}/api/odenmemisBorclarAnonym/list`,
    `${ASAT_ONLINE_BASE}/AnonymDebt/Query`,
    `${ASAT_ONLINE_BASE}/BorcSorgula/Sorgula`,
    `${ASAT_ONLINE_BASE}/webportal/BorcSorgula/Sorgula`,
  ];

  for (const url of postUrls) {
    for (const body of buildContractBodies(contractNumber)) {
      const isJson = body.startsWith('{');
      const result = await tryFetch(url, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
        },
        body,
      });
      attempts.push({ step: `post:${url}`, status: result.response.status });

      if (result.contentType.includes('application/json')) {
        try {
          const json = JSON.parse(result.text);
          const parsed = extractFromJson(json);
          if (parsed) {
            return {
              ok: true,
              balance: parsed.balance ?? 0,
              dueDate: parsed.dueDate,
              source: 'asat_portal',
              attempts,
            };
          }
        } catch {
          // continue
        }
      }

      const parsedHtml = extractFromHtml(result.text);
      if (parsedHtml?.captchaRequired) {
        return {
          ok: false,
          message: 'ASAT reCAPTCHA doğrulaması gerektiriyor. Manuel Gir ile borç ve vade kaydedin.',
          attempts,
        };
      }
      if (parsedHtml) {
        return {
          ok: true,
          balance: parsedHtml.balance ?? 0,
          dueDate: parsedHtml.dueDate,
          source: 'asat_portal',
          attempts,
        };
      }
    }
  }

  const getUrls = [
    `${ASAT_DEBT_PAGE}?sozlesmeNo=${encodeURIComponent(contractNumber)}`,
    `${ASAT_DEBT_PAGE}?contractNumber=${encodeURIComponent(contractNumber)}`,
    `${ASAT_ONLINE_BASE}/odenmemisBorclarAnonym/list?sozlesmeNo=${encodeURIComponent(contractNumber)}`,
  ];

  for (const url of getUrls) {
    const getResult = await tryFetch(url, { headers: { Cookie: cookie } });
    attempts.push({ step: `get:${url}`, status: getResult.response.status });

    if (getResult.contentType.includes('application/json')) {
      try {
        const json = JSON.parse(getResult.text);
        const parsed = extractFromJson(json);
        if (parsed) {
          return {
            ok: true,
            balance: parsed.balance ?? 0,
            dueDate: parsed.dueDate,
            source: 'asat_portal',
            attempts,
          };
        }
      } catch {
        // continue
      }
    }

    const parsedHtml = extractFromHtml(getResult.text);
    if (parsedHtml?.captchaRequired) {
      return {
        ok: false,
        message: 'ASAT reCAPTCHA doğrulaması gerektiriyor. Manuel Gir ile borç ve vade kaydedin.',
        attempts,
      };
    }
    if (parsedHtml) {
      return {
        ok: true,
        balance: parsedHtml.balance ?? 0,
        dueDate: parsedHtml.dueDate,
        source: 'asat_portal',
        attempts,
      };
    }
  }

  const parsedLanding = extractFromHtml(landing.text);
  if (parsedLanding?.captchaRequired) {
    return {
      ok: false,
      message: 'ASAT reCAPTCHA doğrulaması gerektiriyor. Manuel Gir ile borç ve vade kaydedin.',
      attempts,
    };
  }

  return {
    ok: false,
    message: 'ASAT sözleşme sorgusu sonuç vermedi. Manuel Gir ile Ev/İşyeri borcunu kaydedin.',
    attempts,
  };
}

async function probeTarget(url, label) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketPOS/1.0)',
        Accept: 'text/html,application/json,*/*',
      },
    });
    const latencyMs = Date.now() - started;
    const text = await response.text();
    const hasCaptcha = /recaptcha|robot değilim/i.test(text);
    return {
      target: label,
      ok: response.status > 0 && response.status < 500,
      status: response.status,
      latencyMs,
      hasCaptcha,
      detail: hasCaptcha
        ? `Yanıt alındı (${response.status}) — reCAPTCHA koruması var`
        : `Yanıt alındı (${response.status}, ${latencyMs}ms)`,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : 'Bağlantı hatası';
    const timedOut = /timed out|timeout/i.test(message);
    return {
      target: label,
      ok: false,
      latencyMs,
      detail: timedOut
        ? `Zaman aşımı (${PROBE_TIMEOUT_MS}ms) — sunucu bu adrese ulaşamıyor`
        : message,
    };
  }
}

function buildDiagnostics(checks) {
  const mainSite = checks.find((item) => item.target.includes('asat.gov.tr') && !item.target.includes('online'));
  const onlinePortal = checks.find((item) => item.target.includes('online.asat'));
  const mainSiteReachable = Boolean(mainSite?.ok);
  const onlinePortalReachable = Boolean(onlinePortal?.ok);

  let reason = 'OK';
  let summary = 'ASAT portalına erişim başarılı görünüyor.';
  let recommendation = 'Sorguyu tekrar deneyin. Başarısız olursa Manuel Gir kullanın.';

  if (!onlinePortalReachable) {
    reason = mainSiteReachable ? 'NETWORK_TIMEOUT' : 'NETWORK_UNREACHABLE';
    summary = mainSiteReachable
      ? 'ASAT ana sitesi açılıyor ama online.asat.gov.tr erişilemiyor.'
      : 'Sunucu ASAT sitelerine hiç ulaşamıyor.';
    recommendation = 'VPS ağı ASAT online portalını engelliyor veya portal yurtdışı/datacenter IP’lerini kabul etmiyor. Borç için ASAT sitesinden sorgulayıp Manuel Gir kullanın.';
  } else if (onlinePortal?.hasCaptcha) {
    reason = 'CAPTCHA_REQUIRED';
    summary = 'ASAT portalı açılıyor ancak “Ben robot değilim” doğrulaması zorunlu.';
    recommendation = 'Otomatik sorgu teknik olarak mümkün değil. ASAT’ten borcu görüp Manuel Gir ile Ev/İşyeri olarak kaydedin.';
  }

  return {
    checkedAt: new Date().toISOString(),
    mainSiteReachable,
    onlinePortalReachable,
    reason,
    summary,
    recommendation,
    checks: checks.map(({ target, ok, status, latencyMs, detail }) => ({
      target,
      ok,
      status,
      latencyMs,
      detail,
    })),
  };
}

export async function probeAsatConnectivity() {
  const checks = await Promise.all([
    probeTarget(ASAT_MAIN_SITE, 'www.asat.gov.tr'),
    probeTarget(ASAT_DEBT_PAGE, 'online.asat.gov.tr/odenmemisBorclarAnonym'),
  ]);
  return buildDiagnostics(checks);
}

function attachDiagnostics(result, diagnostics) {
  if (!diagnostics) return result;
  const message = result.ok
    ? result.message
    : `${result.message || diagnostics.summary} · ${diagnostics.recommendation}`;
  return {
    ...result,
    diagnostics,
    message,
  };
}

export async function fetchAsatDebt(contractNumber) {
  const normalized = normalizeContractNumber(contractNumber);
  if (!normalized) {
    return { ok: false, contractNumber: '', message: 'Sözleşme numarası gerekli' };
  }

  const diagnostics = await probeAsatConnectivity();

  if (!diagnostics.onlinePortalReachable) {
    return attachDiagnostics({
      ok: false,
      contractNumber: normalized,
      subscriberNumber: normalized,
      message: diagnostics.summary,
    }, diagnostics);
  }

  if (diagnostics.reason === 'CAPTCHA_REQUIRED') {
    return attachDiagnostics({
      ok: false,
      contractNumber: normalized,
      subscriberNumber: normalized,
      message: diagnostics.summary,
    }, diagnostics);
  }

  try {
    const result = await queryAsatPortal(normalized);
    if (!result.ok && /recaptcha|captcha/i.test(result.message || '')) {
      diagnostics.reason = 'CAPTCHA_REQUIRED';
      diagnostics.summary = 'ASAT reCAPTCHA doğrulaması gerektiriyor.';
      diagnostics.recommendation = 'Manuel Gir ile borç ve vade kaydedin.';
    } else if (!result.ok) {
      diagnostics.reason = 'NO_DEBT_DATA';
      diagnostics.summary = result.message || 'Sözleşme sorgusu sonuç vermedi.';
      diagnostics.recommendation = 'ASAT sitesinde sözleşme numarasını kontrol edip Manuel Gir kullanın.';
    }
    return attachDiagnostics({
      contractNumber: normalized,
      subscriberNumber: normalized,
      ...result,
    }, diagnostics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ASAT bağlantı hatası';
    const unreachable = /timed out|timeout|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(message);
    diagnostics.reason = unreachable ? 'NETWORK_TIMEOUT' : 'PORTAL_HTTP_ERROR';
    diagnostics.summary = unreachable
      ? 'ASAT online portalına bağlanılamadı.'
      : message;
    diagnostics.recommendation = 'Manuel Gir ile borç ve vade kaydedin.';
    return attachDiagnostics({
      ok: false,
      contractNumber: normalized,
      subscriberNumber: normalized,
      message: diagnostics.summary,
    }, diagnostics);
  }
}
