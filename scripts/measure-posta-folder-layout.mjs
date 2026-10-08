/**
 * Posta görünümü — klasör değişince sayfa/shell kenar kayması
 * node scripts/measure-posta-folder-layout.mjs
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');
const FOLDERS = [
  ['Yaz', 'button.posta-hub-compose'],
  ['Tümü', 'button.posta-yazisma-thread-card--folder:has-text("Tümü")'],
  ['Gelen kutusu', 'button.posta-yazisma-thread-card--folder:has-text("Gelen kutusu")'],
  ['Müşteri mesajları', 'button.posta-yazisma-thread-card--folder:has-text("Müşteri mesajları")'],
  ['Fatura', 'button.posta-yazisma-thread-card--folder:has-text("Fatura")'],
  ['Kişiler', 'button.posta-yazisma-thread-card--folder:has-text("Kişiler")'],
];

async function buildAuthBootstrap() {
  const res = await fetch(`${BASE}/api/data`);
  const data = await res.json();
  const user = data.users?.find((u) => u.isActive && u.role === 'admin') || data.users?.find((u) => u.isActive);
  const allowedTabs = [...new Set([...(user.allowedTabs || []), 'posta'])];
  return {
    session: {
      userId: user.id,
      sessionId: `S-layout-${Date.now()}`,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      allowedTabs,
      loggedInAt: new Date().toISOString(),
    },
    users: (data.users ?? []).map((u) => (u.id === user.id ? { ...u, allowedTabs } : u)),
  };
}

async function measure(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('.posta-hub-screen--premium');
    const shell = document.querySelector('.posta-hub-shell');
    const detail = document.querySelector('.posta-hub-detail');
    const app = document.querySelector('.app-shell');
    const r = (el) => el?.getBoundingClientRect();
    const sr = r(screen);
    const shr = r(shell);
    const dr = r(detail);
    const ar = r(app);
    return {
      screenClass: screen?.className?.split(/\s+/).filter((c) => c.includes('sohbet') || c.includes('premium')).join(' ') ?? '',
      shellClass: shell?.className?.split(/\s+/).filter((c) => c.includes('shell') || c.includes('yazisma')).join(' ') ?? '',
      screenLeft: sr?.left ?? null,
      screenWidth: sr?.width ?? null,
      shellLeft: shr?.left ?? null,
      shellWidth: shr?.width ?? null,
      detailLeft: dr?.left ?? null,
      detailWidth: dr?.width ?? null,
      appWidth: ar?.width ?? null,
    };
  });
}

async function main() {
  const auth = await buildAuthBootstrap();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript((p) => {
    sessionStorage.setItem('market-pos-auth-session', JSON.stringify(p.session));
    localStorage.setItem('market-pos-users', JSON.stringify(p.users));
  }, auth);
  const page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
  await page.locator('nav.app-topbar-tabs button', { hasText: 'Posta' }).click();
  await page.waitForTimeout(500);
  await page.locator('.posta-hub-view-switch button', { hasText: /^Posta$/ }).click();
  await page.waitForSelector('.posta-hub-shell');

  console.log('BASE', BASE);
  for (const [name, sel] of FOLDERS) {
    await page.locator(sel).first().click();
    await page.waitForTimeout(400);
    const m = await measure(page);
    console.log(
      `${name}: screenW=${Math.round(m.screenWidth)} shellW=${Math.round(m.shellWidth)} detailL=${Math.round(m.detailLeft)} detailW=${Math.round(m.detailWidth)} | ${m.screenClass} | ${m.shellClass}`,
    );
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
