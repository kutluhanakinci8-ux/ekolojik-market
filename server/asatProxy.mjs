import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASAT_ORIGIN = 'https://online.asat.gov.tr';
const PROXY_PREFIX = '/asat-proxy';
const REQUEST_TIMEOUT_MS = 30000;

let injectSnippet = '<script src="/asat-bridge-inject.js"></script>';
try {
  const bridgeScript = readFileSync(join(__dirname, '../public/asat-bridge-inject.js'), 'utf8');
  injectSnippet = `<script>${bridgeScript}</script>`;
} catch {
  // fallback to external script tag
}

function rewriteSetCookieHeader(value) {
  if (!value) return value;
  return value
    .replace(/;\s*Domain=[^;]+/gi, '')
    .replace(/;\s*Secure/gi, '')
    .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=Lax')
    + `; Path=${PROXY_PREFIX}`;
}

function collectSetCookie(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const raw = headers.get?.('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=[^;]+?=)/);
}

function rewriteLocation(location, proxyBase) {
  if (!location) return location;
  if (location.startsWith(ASAT_ORIGIN)) {
    return `${proxyBase}${location.slice(ASAT_ORIGIN.length)}`;
  }
  if (location.startsWith('/') && !location.startsWith(proxyBase)) {
    return `${proxyBase}${location}`;
  }
  return location;
}

function rewriteHtml(html, proxyBase) {
  let output = html
    .replaceAll(ASAT_ORIGIN, proxyBase)
    .replace(/https?:\\\/\\\/online\.asat\.gov\.tr/gi, proxyBase.replace(/\//g, '\\/'))
    .replace(/href="\/(?!\/)/gi, `href="${proxyBase}/`)
    .replace(/src="\/(?!\/)/gi, `src="${proxyBase}/`)
    .replace(/action="\/(?!\/)/gi, `action="${proxyBase}/`);

  if (output.includes('__marketPosAsatInjected')) return output;
  if (/<\/body>/i.test(output)) {
    return output.replace(/<\/body>/i, `${injectSnippet}</body>`);
  }
  return `${output}${injectSnippet}`;
}

function buildUpstreamUrl(pathname, search) {
  const upstreamPath = pathname.startsWith(PROXY_PREFIX)
    ? pathname.slice(PROXY_PREFIX.length) || '/'
    : pathname;
  return `${ASAT_ORIGIN}${upstreamPath}${search || ''}`;
}

function filterRequestHeaders(reqHeaders, upstreamPath) {
  const headers = {
    'User-Agent': reqHeaders['user-agent']
      || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    Accept: reqHeaders.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': reqHeaders['accept-language'] || 'tr-TR,tr;q=0.9',
    Referer: `${ASAT_ORIGIN}${upstreamPath}`,
  };

  if (reqHeaders.cookie) {
    headers.Cookie = reqHeaders.cookie;
  }
  if (reqHeaders['content-type']) {
    headers['Content-Type'] = reqHeaders['content-type'];
  }
  if (reqHeaders.origin) {
    headers.Origin = ASAT_ORIGIN;
  }

  return headers;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function handleAsatProxy(req, res, pathname, search, proxyBase) {
  const upstreamPath = pathname.startsWith(PROXY_PREFIX)
    ? pathname.slice(PROXY_PREFIX.length) || '/'
    : pathname;
  const upstreamUrl = buildUpstreamUrl(pathname, search);
  const method = req.method || 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: filterRequestHeaders(req.headers, upstreamPath),
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const contentType = upstream.headers.get('content-type') || '';
  const responseHeaders = {};

  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding' || lower === 'content-encoding' || lower === 'content-length') {
      continue;
    }
    if (lower === 'location') {
      responseHeaders.Location = rewriteLocation(value, proxyBase);
      continue;
    }
    if (lower === 'set-cookie') {
      continue;
    }
    responseHeaders[key] = value;
  }

  const setCookies = collectSetCookie(upstream.headers);
  if (setCookies.length) {
    responseHeaders['Set-Cookie'] = setCookies.map((cookie) => rewriteSetCookieHeader(cookie));
  }

  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    responseHeaders['Content-Type'] = 'text/html; charset=utf-8';
    responseHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    res.writeHead(upstream.status, responseHeaders);
    res.end(rewriteHtml(html, proxyBase));
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, responseHeaders);
  res.end(buffer);
}

export const ASAT_PROXY_PREFIX = PROXY_PREFIX;
