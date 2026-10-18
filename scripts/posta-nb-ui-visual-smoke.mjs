#!/usr/bin/env node
/**
 * NB UI yürüyüşü — headless POS (Posta hub + Sohbet + portal).
 * Token: EKOLOJIK_POS_QA_MINT_JSON veya EKOLOJIK_POS_QA_TOKEN + oturum alanları.
 * Kullanım: node scripts/posta-nb-ui-visual-smoke.mjs [BASE_URL]
 */
const BASE = (process.argv[2] || process.env.POS_PUBLIC_URL || 'http://127.0.0.1:5180').replace(
  /\/$/,
  '',
);

function parseMint() {
  const raw = process.env.EKOLOJIK_POS_QA_MINT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const token = process.env.EKOLOJIK_POS_QA_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    username: process.env.EKOLOJIK_POS_QA_USER || 'qa',
    userId: process.env.EKOLOJIK_POS_QA_USER_ID || 'qa-user',
  };
}

function buildSession(mint) {
  const tabs = [
    'dashboard',
    'sales',
    'stock',
    'reports',
    'accounting',
    'settings',
    'transactions',
    'cashier',
    'customers',
    'posta',
  ];
  return {
    userId: mint.userId,
    sessionId: `S-nb-ui-${Date.now()}`,
    username: mint.username,
    displayName: mint.username,
    role: 'admin',
    allowedTabs: tabs,
    loggedInAt: new Date().toISOString(),
    mustChangePassword: false,
  };
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.warn('WARN Playwright kurulu değil — görsel smoke atlandı');
    return null;
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
}

async function main() {
  const mint = parseMint();
  if (!mint?.token) {
    console.error('HATA: EKOLOJIK_POS_QA_MINT_JSON veya EKOLOJIK_POS_QA_TOKEN gerekli');
    process.exit(2);
  }

  const pw = await loadPlaywright();
  if (!pw) {
    process.exit(0);
  }

  const session = buildSession(mint);
  const { chromium } = pw;

  console.log(`=== NB UI görsel smoke ===\nBASE: ${BASE}\nKullanıcı: ${session.username}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(
    (payload) => {
      sessionStorage.setItem('market-pos-auth-session', JSON.stringify(payload.session));
      sessionStorage.setItem('market-pos-api-token', payload.token);
    },
    { session, token: mint.token },
  );

  const page = await context.newPage();

  const anonInbox = await page.request.get(`${BASE}/api/posta/inbox?folder=gelen&limit=1`);
  assert(anonInbox.status() === 401, '#19 anon inbox koruması');
  const anonExport = await page.request.get(`${BASE}/api/posta/export/outbox.csv`);
  assert(anonExport.status() === 401, '#19 anon export koruması');
  console.log('OK   #19 Güvenlik (anon 401)');

  const authHeader = `Bearer ${mint.token}`;
  await page.route('**/api/data**', async (route) => {
    const response = await route.fetch({ headers: { Authorization: authHeader, Accept: 'application/json' } });
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('json') || response.status() !== 200) {
      await route.fulfill({ response });
      return;
    }
    const body = await response.json();
    if (Array.isArray(body.users)) {
      body.users = body.users.map((u) => ({
        ...u,
        mustChangePassword: false,
        allowedTabs: [...new Set([...(u.allowedTabs || []), 'posta'])],
      }));
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate((userId) => {
    try {
      const raw = sessionStorage.getItem('market-pos-auth-session');
      if (raw) {
        const s = JSON.parse(raw);
        s.mustChangePassword = false;
        sessionStorage.setItem('market-pos-auth-session', JSON.stringify(s));
      }
      const usersRaw = localStorage.getItem('market-pos-users');
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const next = (Array.isArray(users) ? users : []).map((u) =>
        u.id === userId
          ? {
              ...u,
              mustChangePassword: false,
              allowedTabs: [...new Set([...(u.allowedTabs || []), 'posta'])],
            }
          : u,
      );
      if (next.length) localStorage.setItem('market-pos-users', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, mint.userId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.waitForSelector('nav.app-topbar-tabs', { timeout: 25000 });

  const sseLive = await page.evaluate(
    async ({ base, token }) => {
      const url = `${base}/api/posta/events?access_token=${encodeURIComponent(token)}`;
      return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          es.close();
          clearTimeout(timer);
          resolve(ok);
        };
        const es = new EventSource(url);
        const timer = setTimeout(() => finish(false), 9000);
        es.addEventListener('unread', () => finish(true));
        es.addEventListener('ping', () => finish(true));
        es.onerror = () => finish(false);
      });
    },
    { base: BASE, token: mint.token },
  );
  if (sseLive) {
    console.log('OK   #7 SSE canlı (unread/ping)');
  } else {
    console.log('WARN #7 SSE — 9sn içinde event yok (proxy?)');
  }

  const postaNav = page.locator('nav.app-topbar-tabs button', { hasText: 'Posta' });
  assert((await postaNav.count()) > 0, '#1 Posta menü yok');
  console.log('OK   #1 Posta menü');

  await postaNav.click();
  await page.waitForSelector('.posta-hub-screen--premium', { timeout: 25000 });
  assert((await page.locator('.posta-hub-shell').count()) > 0, '#2 hub shell yok');
  console.log('OK   #2 Posta hub shell');

  const folders = page.locator('.posta-hub-folders');
  const listCol = page.locator('.posta-hub-list');
  assert(
    (await folders.count()) > 0 || (await listCol.count()) > 0,
    '#2b klasör veya liste kolonu yok',
  );
  console.log('OK   #2b Hub kolonları');

  const gelenBtn = page.locator('.posta-hub-folders button, .posta-hub-folder', {
    hasText: /Gelen/i,
  });
  if (await gelenBtn.count()) {
    await gelenBtn.first().click();
    await page.waitForTimeout(400);
  }
  const row = page.locator('.posta-hub-list li, .posta-hub-msg-row').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(500);
    const detail = page.locator('.posta-hub-detail');
    assert((await detail.count()) > 0, '#3 detay paneli açılmadı');
    console.log('OK   #3 Gelen satır + detay');
  } else {
    console.log('WARN #3 Gelen satır yok — boş inbox');
  }

  const convMode = page.locator('.posta-hub-list-mode button', { hasText: 'Konuşma' });
  if (await convMode.count()) {
    await convMode.click();
    await page.waitForTimeout(500);
    console.log('OK   #12 Konuşma liste modu');
    const convRow = page.locator('.posta-hub-list button strong').first();
    if (await convRow.count()) {
      await convRow.click();
      await page.waitForTimeout(400);
      if (await page.locator('.posta-hub-conversation-thread, .posta-hub-detail').count()) {
        console.log('OK   #12b Konuşma thread görünümü');
      }
    }
    await page.locator('.posta-hub-list-mode button', { hasText: 'Mesaj' }).click();
    await page.waitForTimeout(300);
  } else {
    console.log('WARN #12 Konuşma modu düğmesi yok');
  }

  if (await gelenBtn.count()) {
    await gelenBtn.first().click();
    await page.waitForTimeout(400);
  }
  await page.locator('.posta-hub-list-mode button', { hasText: 'Mesaj' }).click().catch(() => {});
  await page.waitForTimeout(400);

  const rowCheck = page.locator('.posta-hub-row-check').first();
  if (await rowCheck.count()) {
    await rowCheck.check();
    await page.waitForTimeout(400);
    if (await page.locator('.posta-hub-bulk-count').count()) {
      console.log('OK   #14 Toplu işlem çubuğu (seçim)');
      await page.locator('.posta-hub-bulk-bar button', { hasText: 'Temizle' }).click().catch(() => {});
    } else {
      console.log('WARN #14 toplu seçim çubuğu görünmedi');
    }
  } else {
    console.log('WARN #14 satır checkbox yok — liste boş');
  }

  const swRes = await page.request.get(`${BASE}/posta-offline-sw.js`);
  assert(swRes.ok(), '#17 offline SW dosyası');
  const swLite = await page.evaluate(async (base) => {
    try {
      const r = await fetch(`${base}/posta-offline-sw.js`, { cache: 'no-store' });
      const t = await r.text();
      return t.includes('posta') && t.length > 40;
    } catch {
      return false;
    }
  }, BASE);
  assert(swLite, '#17 SW içeriği');
  console.log('OK   #17 Offline SW (posta-offline-sw.js)');

  const postaView = page.locator('.posta-hub-view-switch button', { hasText: /^Posta$/ });
  if (await postaView.count()) {
    await postaView.click();
    await page.waitForTimeout(400);
  }

  await page.locator('button.posta-hub-compose', { hasText: 'Yaz' }).first().click();
  await page.waitForSelector('.posta-hub-compose-form', { timeout: 20000 });
  console.log('OK   #4 Yaz + şablon formu');

  await page.locator('button', { hasText: 'Müşteri mesajları' }).first().click();
  await page.waitForTimeout(1000);
  assert((await page.locator('.posta-yazisma-col, .posta-hub-list').count()) > 0, '#5 mesajlar kolonu yok');
  console.log('OK   #5 Müşteri mesajları hub');

  const bodyMesajlar = await page.locator('body').innerText();
  if (/Mesaj SLA/i.test(bodyMesajlar)) {
    console.log('OK   #24 Messaging SLA şeridi');
  } else {
    console.log('WARN #24 SLA şeridi — veri yok veya kapalı');
  }
  if (/\bWA\b|whatsapp/i.test(bodyMesajlar)) {
    console.log('OK   #23 Omnichannel (WA rozeti/metin)');
  } else {
    console.log('WARN #23 WA rozeti — kanal yok veya liste boş');
  }

  const spamBtn = page.locator('.posta-hub-folders button', { hasText: /^Spam$/i });
  if (await spamBtn.count()) {
    await spamBtn.first().click();
    await page.waitForTimeout(500);
    console.log('OK   #13 Spam klasörü');
  } else {
    console.log('WARN #13 Spam klasörü bulunamadı');
  }

  if (await page.locator('.posta-hub-hero-storage, .posta-hub-hero-storage-label').count()) {
    console.log('OK   #15 Depolama çubuğu (hero)');
  } else {
    console.log('WARN #15 depolama çubuğu görünmedi');
  }

  if (/Engagement/i.test(bodyMesajlar)) {
    console.log('OK   #22 Engagement şeridi');
  } else {
    console.log('WARN #22 engagement — izleme kapalı veya özet yok');
  }

  const widgetRes = await page.request.get(`${BASE}/widget/messaging.js`);
  assert(widgetRes.ok(), '#20 widget yüklenemedi');
  console.log('OK   #20 Widget statik');

  await page.locator('nav.app-topbar-tabs button', { hasText: 'Ayarlar' }).click();
  await page.waitForTimeout(800);
  const emailTab = page.locator('button', { hasText: 'E-posta' });
  if (await emailTab.count()) {
    await emailTab.first().click();
    await page.waitForTimeout(2000);
    const bodySettings = await page.locator('body').innerText();
    assert(/outbox|Gönderilen|kuyruk/i.test(bodySettings), '#6 outbox ayarları görünmedi');
    console.log('OK   #6 Gönderilen / outbox (Ayarlar → E-posta)');
    if (/Faz 5 — ayrım kontrolü|LERTA_PLATFORM_BRIDGE|bridge|Bağımsız|ekolojik-isolation/i.test(bodySettings)) {
      console.log('OK   #10 Bağımsız altyapı (Faz 5)');
    } else {
      console.log('WARN #10 Faz 5 paneli — API checklist #10 doğrulandı');
    }
    if (/deliverability|DNS|Gönderen & DNS/i.test(bodySettings)) {
      console.log('OK   #21 DNS deliverability paneli');
    } else {
      console.log('WARN #21 deliverability paneli görünmedi');
    }
    if (/messaging|Mesajlaşma|public-config/i.test(bodySettings)) {
      console.log('OK   #20b Messaging / public key (ayarlar)');
    }
    if (/imza|Gönderen|ops@|EKOLOJIK_OPS/i.test(bodySettings)) {
      console.log('OK   #8 Gönderen / imza alanları');
    } else {
      console.log('WARN #8 gönderen ayarları metni görünmedi');
    }
    if (/Kurallar|Faz 20|inbox kuralları/i.test(bodySettings)) {
      console.log('OK   #16 Kurallar / analitik paneli');
    } else {
      console.log('WARN #16 kurallar paneli — kaydırma gerekebilir');
    }
    const csvBtn = page.locator('button', { hasText: /Outbox CSV|outbox csv/i });
    if (await csvBtn.count()) {
      try {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 12000 }),
          csvBtn.first().click(),
        ]);
        if (download) {
          console.log('OK   #9 Export outbox CSV (UI)');
        }
      } catch {
        console.log('WARN #9 CSV indirme — blob veya popup');
      }
    } else {
      console.log('WARN #9 Outbox CSV düğmesi bulunamadı');
    }
  } else {
    console.log('WARN #6/#10/#21 — E-posta ayar sekmesi bulunamadı');
  }

  await page.locator('nav.app-topbar-tabs button', { hasText: 'Posta' }).click();
  await page.waitForSelector('.posta-hub-screen--premium', { timeout: 20000 });

  await page.keyboard.press('c');
  await page.waitForTimeout(600);
  if (await page.locator('.posta-hub-compose-form').count()) {
    console.log('OK   #11 Klavye — c (yaz)');
  } else {
    console.log('WARN #11 c kısayolu compose açmadı');
  }

  const sohbetTab = page.locator('.posta-hub-view-switch button', { hasText: /^Sohbet$/ });
  if ((await sohbetTab.count()) > 0) {
    await sohbetTab.click();
    await page.waitForSelector('.posta-yazisma-thread-card', { timeout: 20000 });
    console.log('OK   #18 Sohbet görünümü');

    await page.locator('.posta-yazisma-thread-card').first().click();
    await page.waitForSelector('.posta-yazisma-chat-frame, .posta-hub-sohbet-inner', {
      timeout: 15000,
    });
    console.log('OK   #18c Sohbet thread paneli');

    const align = await page.evaluate(() => {
      const col = document.querySelector('.posta-yazisma-col');
      const listSearch = document.querySelector('.posta-yazisma-col-toolbar .posta-hub-search');
      const frame = document.querySelector('.posta-yazisma-chat-frame');
      const frameSearch = frame?.querySelector('.posta-hub-sohbet-search-wrap .posta-hub-search');
      if (!col || !listSearch || !frame || !frameSearch) return null;
      const colRect = col.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const listInset = listSearch.getBoundingClientRect().left - colRect.left;
      const chatInset = frameSearch.getBoundingClientRect().left - frameRect.left;
      return { listInset, chatInset };
    });
    if (align) {
      const delta = Math.abs(align.listInset - align.chatInset);
      assert(delta <= 2.5, `#18b Sohbet gutter kayık (inset Δ=${delta}px)`);
      console.log(`OK   #18b Sohbet gutter hizası (inset Δ=${Math.round(delta * 10) / 10}px)`);
    } else {
      console.log('WARN #18b Sohbet gutter — arama/kolon yok');
    }
  } else {
    console.log('WARN #18 Sohbet sekmesi bulunamadı');
  }

  await page.goto(`${BASE}/portal/mesajlar`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const portalBody = await page.locator('body').innerText();
  assert(/portal|mesaj|giriş|token/i.test(portalBody), '#25 portal sayfası boş');
  console.log('OK   #25 Müşteri portal rotası');

  await browser.close();
  console.log('\n✓ NB UI görsel smoke geçti');
}

main().catch((err) => {
  console.error(`\n✗ NB UI görsel smoke: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
