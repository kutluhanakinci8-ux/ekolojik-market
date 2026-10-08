/**
 * Sol klasör menüsü — her öğenin sol/sağ inset ölçümü.
 * node scripts/measure-folder-insets.mjs [BASE_URL]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');

async function buildAuthBootstrap() {
  const res = await fetch(`${BASE}/api/data`);
  if (!res.ok) throw new Error(`/api/data ${res.status}`);
  const data = await res.json();
  const user =
    data.users?.find((u) => u.isActive && u.mustChangePassword !== true && u.role === 'admin') ||
    data.users?.find((u) => u.isActive && u.mustChangePassword !== true);
  if (!user) throw new Error('Aktif kullanıcı bulunamadı');
  const allowedTabs = [...new Set([...(user.allowedTabs || []), 'posta'])];
  const session = {
    userId: user.id,
    sessionId: `S-folder-${Date.now()}`,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedTabs,
    loggedInAt: new Date().toISOString(),
  };
  const users = (data.users ?? []).map((u) => (u.id === user.id ? { ...u, allowedTabs } : u));
  return { session, users };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

async function measureFolders(page) {
  return page.evaluate(() => {
    const aside = document.querySelector('.posta-hub-folders');
    if (!aside) return { error: 'no aside' };
    const asideRect = aside.getBoundingClientRect();
    const asideCs = getComputedStyle(aside);
    const scroll = aside.querySelector('.posta-klasor-scroll');
    const nodes = scroll ? [...scroll.children] : [...aside.children];
    const rows = nodes.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const label =
        el.tagName === 'BUTTON'
          ? el.textContent?.trim()
          : el.classList.contains('posta-hub-folder-group')
            ? `§ ${el.textContent?.trim()}`
            : el.querySelector('small')?.textContent?.trim() || el.className;
      return {
        label,
        tag: el.tagName,
        className: el.className.slice(0, 60),
        left: r.left,
        right: r.right,
        width: r.width,
        relLeft: round(r.left - asideRect.left),
        relRight: round(asideRect.right - r.right),
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
      };
    });
    function round(n) {
      return Math.round(n * 10) / 10;
    }
    return {
      asidePadding: asideCs.padding,
      asideWidth: asideRect.width,
      rows,
    };
  });
}

async function main() {
  const { session, users } = await buildAuthBootstrap();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript((payload) => {
    sessionStorage.setItem('market-pos-auth-session', JSON.stringify(payload.session));
    localStorage.setItem('market-pos-users', JSON.stringify(payload.users));
  }, { session, users });
  const page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('nav.app-topbar-tabs button', { hasText: 'Posta' }).click();
  await page.waitForTimeout(600);
  const postaTab = page.locator('.posta-hub-view-switch button', { hasText: /^Posta$/ });
  if (await postaTab.count()) await postaTab.click();
  await page.waitForSelector('.posta-hub-folders', { timeout: 30000 });
  const m = await measureFolders(page);
  console.log(JSON.stringify(m, null, 2));
  const buttons = m.rows?.filter((r) => r.tag === 'BUTTON') ?? [];
  const relLefts = [...new Set(buttons.map((b) => b.relLeft))];
  const relRights = [...new Set(buttons.map((b) => b.relRight))];
  const groups = m.rows?.filter((r) => r.className?.includes('folder-group')) ?? [];
  const textLefts = buttons.map((b) => round(b.left + 14));
  const groupTextLefts = groups.map((g) => round(g.left));
  console.log('\nButton relLeft unique:', relLefts);
  console.log('Button relRight unique:', relRights);
  console.log('Button label est. left (px):', [...new Set(textLefts)]);
  console.log('Group label left (px):', [...new Set(groupTextLefts)]);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
