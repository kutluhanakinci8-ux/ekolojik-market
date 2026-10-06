import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const DATA_DIR = join(__dirname, 'data');
const STORE_FILE = join(DATA_DIR, 'store.json');
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
  if (ext === '.html' || ext === '.js' || ext === '.css') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers.Pragma = 'no-cache';
    headers.Expires = '0';
  }
  res.writeHead(200, headers);
  res.end(data);
}

async function readStoreData() {
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeStoreData(data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
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

    if (pathname === '/api/client-ip' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ip: getRequestIp(req) }));
      return;
    }

    if (pathname === '/api/data' && req.method === 'GET') {
      const data = await readStoreData();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data ?? {}));
      return;
    }

    if (pathname === '/api/data' && req.method === 'PUT') {
      const data = await readRequestBody(req);
      if (!data || typeof data !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: 'Geçersiz veri' }));
        return;
      }
      data.updatedAt = data.updatedAt || new Date().toISOString();
      await writeStoreData(data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updatedAt: data.updatedAt }));
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
