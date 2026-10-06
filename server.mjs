import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAsatDebt, probeAsatConnectivity } from './server/asatClient.mjs';
import { createFaturaSession, queryFaturaDebt } from './server/faturaOdemelisinClient.mjs';
import { prepareOdemeSession, queryOdemeDebt } from './server/odemeComTrClient.mjs';
import { pollBillEmails, testBillEmailConnection } from './server/billEmailClient.mjs';
import { readTenantStore, writeTenantStore, registerTenant, saveContactMessage } from './server/tenantAuth.mjs';
import { sendCrmEmail } from './server/crmOutreach.mjs';
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
const DIST = join(__dirname, 'dist');
const DATA_DIR = join(__dirname, 'data');
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
  return readTenantStore(DATA_DIR, tenantId);
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
        const result = await pollBillEmails(data ?? {});
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

    if (pathname === '/api/contact' && req.method === 'POST') {
      const data = await readRequestBody(req);
      try {
        const result = await saveContactMessage(DATA_DIR, data ?? {});
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
      data.updatedAt = data.updatedAt || new Date().toISOString();
      await writeStoreData(data, tenantId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updatedAt: data.updatedAt }));
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

server.listen(PORT, HOST, () => {
  console.log(`Market POS → http://${HOST}:${PORT}`);
});
