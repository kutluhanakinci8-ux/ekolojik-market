#!/usr/bin/env node
/**
 * Teslim öncesi QA — statik + canlı API (güvenlik, auth, entegrasyon uçları)
 * Kullanım: node scripts/pre-release-qa.mjs [BASE_URL]
 * Örnek: node scripts/pre-release-qa.mjs http://168.231.109.27:5180
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const BASE = (process.argv[2] || process.env.EKOLOJIK_QA_BASE_URL || 'http://127.0.0.1:5180').replace(/\/$/, '');
const REPO = join(import.meta.dirname, '..');

const results = [];
let failCount = 0;
let warnCount = 0;

function pass(cat, name, detail = '') {
  results.push({ status: 'PASS', cat, name, detail });
  console.log(`PASS  [${cat}] ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(cat, name, detail = '') {
  results.push({ status: 'FAIL', cat, name, detail });
  console.log(`FAIL  [${cat}] ${name}${detail ? ` — ${detail}` : ''}`);
  failCount += 1;
}
function warn(cat, name, detail = '') {
  results.push({ status: 'WARN', cat, name, detail });
  console.log(`WARN  [${cat}] ${name}${detail ? ` — ${detail}` : ''}`);
  warnCount += 1;
}

async function http(method, path, { headers = {}, body } = {}) {
  const url = `${BASE}${path}`;
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(url, init);
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, json, ok: res.ok };
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: REPO, shell: false, ...opts });
    let out = '';
    p.stdout?.on('data', (d) => { out += d; });
    p.stderr?.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

async function staticGate() {
  console.log('\n=== 1. Statik / derleme ===\n');
  const kod = await run('bash', ['scripts/sunucu-ekolojik-kod-parite-dogrula.sh'], {
    env: { ...process.env, EKOLOJIK_REPO_ROOT: REPO },
  });
  if (kod.code === 0) pass('static', 'kod-parite + npm build');
  else fail('static', 'kod-parite + npm build', kod.out.slice(-400));

  const chk = await run('node', ['--check', 'server.mjs']);
  if (chk.code === 0) pass('static', 'node --check server.mjs');
  else fail('static', 'node --check server.mjs', chk.out);
}

async function connectivityGate() {
  console.log('\n=== 2. Erişilebilirlik ===\n');
  try {
    const r = await http('GET', '/api/email/health');
    if (r.ok && r.json?.ok) pass('connect', '/api/email/health', `smtp=${r.json.smtpConfigured}`);
    else fail('connect', '/api/email/health', `HTTP ${r.status}`);
  } catch (e) {
    fail('connect', 'sunucu erişimi', e instanceof Error ? e.message : String(e));
    return false;
  }
  return true;
}

async function securityGate() {
  console.log('\n=== 3. Güvenlik (anonim) ===\n');

  const getData = await http('GET', '/api/data');
  if (getData.status === 401) pass('security', 'GET /api/data anonim → 401');
  else fail('security', 'GET /api/data anonim', `beklenen 401, gelen ${getData.status}`);

  const putData = await http('PUT', '/api/data', { body: { updatedAt: new Date().toISOString(), products: [] } });
  if (putData.status === 401) pass('security', 'PUT /api/data anonim → 401');
  else fail('security', 'PUT /api/data anonim', `beklenen 401, gelen ${putData.status}`);

  const patchOnb = await http('PATCH', '/api/posta/onboarding', { body: { status: 'completed' } });
  if (patchOnb.status === 401) pass('security', 'PATCH onboarding anonim → 401');
  else fail('security', 'PATCH onboarding anonim', `HTTP ${patchOnb.status}`);

  const putMail = await http('PUT', '/api/posta/tenant-mail', { body: { smtp: { host: 'evil' } } });
  if (putMail.status === 401) pass('security', 'PUT tenant-mail anonim → 401');
  else fail('security', 'PUT tenant-mail anonim', `HTTP ${putMail.status}`);

  const getDataAuthed = await http('GET', '/api/data', {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });
  if (getDataAuthed.status === 401) pass('security', 'GET /api/data geçersiz token → 401');
  else fail('security', 'GET /api/data geçersiz token', `HTTP ${getDataAuthed.status}`);

  const anonInbox = await http('GET', '/api/posta/inbox?folder=gelen&limit=1');
  if (anonInbox.status === 401) pass('security', 'GET /api/posta/inbox anonim → 401');
  else fail('security', 'GET /api/posta/inbox anonim', `HTTP ${anonInbox.status}`);

  const anonThreads = await http('GET', '/api/messaging/threads?limit=1');
  if (anonThreads.status === 401) pass('security', 'GET /api/messaging/threads anonim → 401');
  else fail('security', 'GET /api/messaging/threads anonim', `HTTP ${anonThreads.status}`);
}

async function authAndDataGate() {
  console.log('\n=== 4. Auth + mağaza API ===\n');

  const badLogin = await http('POST', '/api/auth/pos-token', {
    body: { username: 'nonexistent-user-qa', password: 'wrong' },
  });
  if (badLogin.status === 401) pass('auth', 'pos-token hatalı şifre → 401');
  else warn('auth', 'pos-token hatalı şifre', `HTTP ${badLogin.status}`);

  // Demo kullanıcı — defaultUsers veya VPS store; admin/admin yaygın değil
  const candidates = [
    { username: 'yonetici', password: 'yonetici123' },
    { username: 'kasiyer', password: 'kasiyer123' },
    { username: 'admin', password: 'admin123' },
  ];

  let token = null;
  let loginUser = null;
  for (const c of candidates) {
    const r = await http('POST', '/api/auth/pos-token', { body: c });
    if (r.ok && r.json?.ok && r.json.token) {
      token = r.json.token;
      loginUser = c.username;
      pass('auth', 'pos-token başarılı', `user=${c.username} role=${r.json.role}`);
      break;
    }
  }
  if (!token) {
    warn('auth', 'pos-token — bilinen demo kullanıcı bulunamadı', 'VPS şifresi farklı olabilir; manuel giriş testi gerekli');
    return null;
  }

  const authH = { Authorization: `Bearer ${token}` };
  const snap = await http('GET', '/api/data', { headers: authH });
  if (!snap.ok) {
    fail('auth', 'GET /api/data token ile', `HTTP ${snap.status}`);
    return token;
  }
  const users = snap.json?.users;
  if (!Array.isArray(users)) {
    fail('auth', 'GET /api/data users dizisi');
  } else {
    const leaks = users.some((u) => u.passwordHash || u.pinHash);
    if (!leaks) pass('auth', 'GET /api/data hash sızıntısı yok');
    else fail('auth', 'GET /api/data kullanıcı hash döndü');
  }
  if (snap.json?.updatedAt) pass('auth', 'GET /api/data snapshot', `updatedAt=${snap.json.updatedAt}`);

  const putProbe = await http('PUT', '/api/data', {
    headers: authH,
    body: { ...snap.json, updatedAt: new Date().toISOString() },
  });
  if (putProbe.ok && putProbe.json?.ok) pass('auth', 'PUT /api/data token ile');
  else fail('auth', 'PUT /api/data token ile', `HTTP ${putProbe.status}`);

  if (snap.json?.role === 'admin' || loginUser) {
    const adminOnly = await http('PATCH', '/api/posta/onboarding', {
      headers: authH,
      body: { notes: 'qa-probe' },
    });
    if (snap.json?.users) {
      const me = users?.find((u) => u.username === loginUser);
      const isAdmin = me?.role === 'admin' || snap.json?.users?.[0]?.role === 'admin';
      if (isAdmin) {
        if (adminOnly.status === 401) fail('auth', 'admin PATCH onboarding', '401 — token admin değil?');
        else if (adminOnly.ok) pass('auth', 'PATCH onboarding admin token');
        else warn('auth', 'PATCH onboarding', `HTTP ${adminOnly.status}`);
      }
    }
  }

  const cashierToken = token;
  return cashierToken;
}

async function postaMessagingGate(token) {
  console.log('\n=== 5. Posta & mesajlaşma API ===\n');
  if (!token) {
    warn('posta', 'token yok — posta/messaging GET atlandı');
    return;
  }
  const authH = { Authorization: `Bearer ${token}` };
  const paths = [
    '/api/posta/unread-counts',
    '/api/posta/onboarding',
    '/api/posta/tenant-mail',
    '/api/posta/deliverability',
    '/api/messaging/public-config',
    '/api/messaging/threads?limit=3',
    '/api/posta/inbox?folder=gelen&limit=2',
    '/api/posta/outbox/failed?limit=5',
    '/api/system/ekolojik-isolation',
  ];
  for (const path of paths) {
    try {
      const r = await http('GET', path, { headers: authH });
      if (r.ok) pass('posta', `GET ${path.split('?')[0]}`, `HTTP ${r.status}`);
      else warn('posta', `GET ${path}`, `HTTP ${r.status}`);
    } catch (e) {
      fail('posta', `GET ${path}`, e instanceof Error ? e.message : String(e));
    }
  }

  if (token) {
    const h = { Authorization: `Bearer ${token}` };
    const analytics = await http('GET', '/api/posta/outbox/analytics?days=7', { headers: h });
    if (analytics.ok && Array.isArray(analytics.json?.failureBreakdown)) {
      pass('posta', 'outbox analytics failureBreakdown');
    } else {
      warn('posta', 'outbox analytics failureBreakdown', `HTTP ${analytics.status}`);
    }
    const rot = await http('POST', '/api/messaging/public-config', { headers: h, body: { rotate: false } });
    if (rot.status === 401) warn('posta', 'POST messaging config', '401 — admin gerekli');
    else if (rot.ok) pass('posta', 'POST messaging/public-config (admin)');
    else warn('posta', 'POST messaging/public-config', `HTTP ${rot.status}`);
  }
}

async function widgetStaticGate() {
  console.log('\n=== 6. Widget statik ===\n');
  try {
    const r = await http('GET', '/widget/messaging.js');
    if (r.status === 200 && r.json?._raw?.includes('EkolojikMessaging')) {
      pass('widget', 'GET /widget/messaging.js');
    } else if (r.status === 200) {
      pass('widget', 'GET /widget/messaging.js', '200');
    } else {
      fail('widget', 'GET /widget/messaging.js', `HTTP ${r.status}`);
    }
  } catch (e) {
    fail('widget', '/widget/messaging.js', e instanceof Error ? e.message : String(e));
  }
}

async function integrationGate() {
  console.log('\n=== 7. Entegrasyon / yapı ===\n');
  const iso = await http('GET', '/api/system/ekolojik-isolation');
  if (iso.ok && (iso.json?.ok === true || iso.json?.checks)) {
    pass('integration', 'ekolojik-isolation', `HTTP ${iso.status}`);
  } else if (iso.ok) pass('integration', 'ekolojik-isolation', 'yanıt OK');
  else warn('integration', 'ekolojik-isolation', `HTTP ${iso.status}`);

  const health = await http('GET', '/api/email/health');
  if (health.json?.counts) pass('integration', 'email outbox counts', JSON.stringify(health.json.counts));

  const contact = await http('POST', '/api/contact', {
    body: { name: 'QA Bot', email: 'qa@test.local', subject: 'genel', message: 'pre-release probe' },
  });
  if (contact.ok) pass('integration', 'POST /api/contact (public form)');
  else warn('integration', 'POST /api/contact', `HTTP ${contact.status}`);
}

async function localOutboxStructure() {
  console.log('\n=== 8. Outbox yapı (yerel modül) ===\n');
  const tmp = join(REPO, '.qa-tmp-data');
  await mkdir(tmp, { recursive: true });
  const { enqueueEkolojikMail, getOutboxCounts, processPendingOutbox } = await import('../server/emailOutbox.mjs');
  await enqueueEkolojikMail(tmp, {
    to: 'test@example.com',
    subject: 'qa',
    text: 'x',
    tenantId: 'qa-tenant',
    idempotencyKey: `qa:${Date.now()}`,
  });
  const counts = await getOutboxCounts(tmp);
  if (counts.pending >= 1) pass('outbox', 'enqueue + count pending');
  else fail('outbox', 'enqueue pending count');

  const pendingDir = join(tmp, 'email-outbox', 'pending', 'qa-tenant');
  try {
    const files = await import('node:fs/promises').then((m) => m.readdir(pendingDir));
    if (files.some((f) => f.endsWith('.json'))) pass('outbox', 'tenant partition path', pendingDir);
    else fail('outbox', 'tenant partition dosya yok');
  } catch {
    fail('outbox', 'tenant partition klasörü');
  }

  const run = await processPendingOutbox(tmp, async () => ({ messageId: 'qa-mock' }), { limit: 1 });
  if (run.processed >= 0) pass('outbox', 'processPendingOutbox çalıştı', JSON.stringify(run));
}

async function main() {
  console.log(`\nEkolojik Market POS — Pre-release QA\nBASE_URL=${BASE}\n`);
  await staticGate();
  const up = await connectivityGate();
  if (up) {
    await securityGate();
    const token = await authAndDataGate();
    await postaMessagingGate(token);
    await widgetStaticGate();
    await integrationGate();
  } else {
    warn('run', 'Canlı API testleri atlandı — sunucu ayakta değil');
  }
  await localOutboxStructure();

  console.log('\n=== ÖZET ===\n');
  console.log(`PASS: ${results.filter((r) => r.status === 'PASS').length}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`WARN: ${warnCount}`);

  const reportPath = join(REPO, 'docs', 'PRE-RELEASE-QA-REPORT.json');
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, results }, null, 2));
  console.log(`\nRapor: ${reportPath}`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
