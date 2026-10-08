/**
 * Ölçüm: Sohbet yazışma listesi + açık thread paneli kenar boşlukları (canlı veya yerel).
 * Kullanım: node scripts/measure-sohbet-insets.mjs [BASE_URL]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');
const VIEWPORT = { width: 1366, height: 900 };

function round(n) {
  return Math.round(n * 10) / 10;
}

async function buildAuthBootstrap() {
  const res = await fetch(`${BASE}/api/data`);
  if (!res.ok) throw new Error(`/api/data ${res.status}`);
  const data = await res.json();
  const user =
    data.users?.find((u) => u.isActive && u.mustChangePassword !== true && u.role === 'admin') ||
    data.users?.find((u) => u.isActive && u.mustChangePassword !== true) ||
    data.users?.find((u) => u.isActive);
  if (!user) throw new Error('Aktif kullanıcı bulunamadı');
  const allowedTabs = [...new Set([...(user.allowedTabs || []), 'posta'])];
  const session = {
    userId: user.id,
    sessionId: `S-measure-${Date.now()}`,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedTabs,
    loggedInAt: new Date().toISOString(),
  };
  const users = (data.users ?? []).map((u) =>
    u.id === user.id ? { ...u, allowedTabs } : u,
  );
  return { session, users };
}

async function measureList(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.posta-hub-list-rail--sohbet');
    const railRect = rail?.getBoundingClientRect();
    const search = document.querySelector('.posta-hub-list--sohbet .posta-hub-search');
    const searchRect = search?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.posta-hub-list--sohbet .posta-hub-thread-btn')];
    return {
      railLeft: railRect?.left ?? null,
      railWidth: railRect?.width ?? null,
      searchLeft: searchRect?.left ?? null,
      threads: buttons.map((btn, i) => {
        const r = btn.getBoundingClientRect();
        const cs = getComputedStyle(btn);
        const li = btn.closest('li');
        const liR = li?.getBoundingClientRect();
        return {
          index: i,
          name: btn.querySelector('.posta-hub-thread-top strong')?.textContent?.trim().slice(0, 40) ?? '',
          btnLeft: r.left,
          btnRight: r.right,
          liLeft: liR?.left ?? null,
          paddingLeft: cs.paddingLeft,
          marginLeft: cs.marginLeft,
          borderLeftWidth: cs.borderLeftWidth,
          boxShadow: cs.boxShadow !== 'none' ? 'yes' : 'no',
          unread: btn.classList.contains('is-unread'),
          pinned: Boolean(btn.querySelector('.posta-hub-thread-pin')),
        };
      }),
    };
  });
}

async function measureOpenThread(page) {
  return page.evaluate(() => {
    const inner = document.querySelector('.posta-hub-sohbet-inner');
    if (!inner) return null;
    const innerRect = inner.getBoundingClientRect();
    const csInner = getComputedStyle(inner);
    const pick = (sel) => {
      const el = inner.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        left: r.left,
        right: r.right,
        width: r.width,
        padL: cs.paddingLeft,
        padR: cs.paddingRight,
        marginL: cs.marginLeft,
        relLeft: r.left - innerRect.left,
      };
    };
    const msgs = [...document.querySelectorAll('.posta-hub-sohbet-messages .posta-sohbet-msg')];
    const bubbles = msgs.slice(0, 6).map((msg) => {
      const body = msg.querySelector('.posta-sohbet-msg-body');
      const r = body?.getBoundingClientRect();
      const cs = body ? getComputedStyle(body) : null;
      return {
        dir: msg.classList.contains('crm-msg--customer') ? 'customer' : 'staff',
        bodyLeft: r?.left ?? null,
        bodyRight: r?.right ?? null,
        relLeft: r ? r.left - innerRect.left : null,
        relRight: r ? innerRect.right - r.right : null,
        marginL: cs?.marginLeft ?? null,
        marginR: cs?.marginRight ?? null,
        maxWidth: cs?.maxWidth ?? null,
      };
    });
    return {
      innerPad: csInner.padding,
      innerRel: { left: innerRect.left, width: innerRect.width },
      header: pick('.posta-hub-sohbet-header'),
      search: pick('.posta-hub-sohbet-search-wrap'),
      messages: pick('.posta-hub-sohbet-messages'),
      compose: pick('.posta-hub-sohbet-compose'),
      bubbles,
    };
  });
}

async function openSohbet(page) {
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('nav.app-topbar-tabs button', { hasText: 'Posta' }).click();
  await page.waitForTimeout(800);
  const sohbetTab = page.locator('.posta-hub-view-switch button', { hasText: 'Sohbet' });
  if (await sohbetTab.count()) {
    await sohbetTab.click();
    await page.waitForTimeout(600);
  }
  await page.waitForSelector('.posta-hub-list--sohbet .posta-hub-thread-btn', { timeout: 20000 });
}

async function main() {
  const { session, users } = await buildAuthBootstrap();
  console.log(`BASE: ${BASE}`);
  console.log(`Oturum: ${session.username} (${session.role})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await context.addInitScript((payload) => {
    sessionStorage.setItem('market-pos-auth-session', JSON.stringify(payload.session));
    localStorage.setItem('market-pos-users', JSON.stringify(payload.users));
  }, { session, users });

  await openSohbet(page);

  const listBase = await measureList(page);
  const railLeft = listBase.railLeft;
  const listRows = listBase.threads.map((t) => ({
    ...t,
    deltaFromRail: railLeft != null ? round(t.btnLeft - railLeft) : null,
    deltaFromSearch: listBase.searchLeft != null ? round(t.btnLeft - listBase.searchLeft) : null,
  }));

  console.log('\n=== Yazışma listesi (sol kenar, px) ===');
  console.log(`Rail sol: ${round(listBase.railLeft)} | Arama sol: ${round(listBase.searchLeft)}`);
  for (const row of listRows) {
    console.log(
      `#${row.index + 1} ${row.unread ? '●' : '○'} ${row.pinned ? '📌' : '  '} | btn=${round(row.btnLeft)} Δrail=${row.deltaFromRail} Δarama=${row.deltaFromSearch} padL=${row.paddingLeft} borderL=${row.borderLeftWidth}`,
    );
  }
  const btnLefts = listRows.map((r) => round(r.btnLeft));
  const uniqueBtnLeft = [...new Set(btnLefts)];
  console.log(`\nListe kartları benzersiz btn.left: ${uniqueBtnLeft.join(', ')} (adet: ${uniqueBtnLeft.length}/${btnLefts.length})`);

  const threadMeasures = [];
  const buttons = page.locator('.posta-hub-list--sohbet .posta-hub-thread-btn');
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    await page.waitForSelector('.posta-hub-sohbet-inner', { timeout: 15000 });
    await page.waitForTimeout(400);
    const name = await buttons.nth(i).evaluate((el) => el.querySelector('.posta-hub-thread-top strong')?.textContent?.trim() ?? '');
    const m = await measureOpenThread(page);
    threadMeasures.push({ name: name.slice(0, 36), ...m });
  }

  console.log('\n=== Açık konuşma paneli (her thread) ===');
  for (const tm of threadMeasures) {
    if (!tm.innerRel) {
      console.log(`— ${tm.name}: panel yok`);
      continue;
    }
    const h = tm.header?.relLeft;
    const s = tm.search?.relLeft;
    const c = tm.compose?.relLeft;
    const msg = tm.messages?.relLeft;
    console.log(`\n${tm.name}`);
    console.log(`  inner padding: ${tm.innerPad}`);
    console.log(`  header/search/messages/compose relLeft: ${h}, ${s}, ${msg}, ${c}`);
    const relLefts = (tm.bubbles || []).map((b) => `${b.dir}:${round(b.relLeft)}`);
    console.log(`  ilk balonlar relLeft: ${relLefts.join(' | ')}`);
  }

  const headerLefts = threadMeasures.map((t) => round(t.header?.relLeft ?? NaN));
  const composeLefts = threadMeasures.map((t) => round(t.compose?.relLeft ?? NaN));
  const uniqHeader = [...new Set(headerLefts.filter((x) => !Number.isNaN(x)))];
  const uniqCompose = [...new Set(composeLefts.filter((x) => !Number.isNaN(x)))];
  console.log(`\nÖzet — header relLeft benzersiz: ${uniqHeader.join(', ')} (${uniqHeader.length})`);
  console.log(`Özet — compose relLeft benzersiz: ${uniqCompose.join(', ')} (${uniqCompose.length})`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
