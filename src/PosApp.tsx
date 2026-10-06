import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { setCurrencyDisplaySettings } from './utils/format';
import { AppShell } from './components/AppShell';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DashboardScreen } from './components/DashboardScreen';
import { AccountingScreen } from './components/AccountingScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SalesScreen } from './components/SalesScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { StockScreen } from './components/StockScreen';
import { EkolojikPostaHubScreen } from './components/posta/EkolojikPostaHubScreen';
import { useIdleLogout } from './hooks/useIdleLogout';
import { useStore } from './store/useStore';
import { canAccessPage, canRevealCostProfit, getDefaultLandingPage } from './utils/userAccess';
import { resolveTopNavHighlight } from './data/navigation';
import type { AppPage } from './components/AppShell';
import { fetchPostaUnreadCounts } from './services/postaInboxService';

function renderPage(page: AppPage, store: ReturnType<typeof useStore>) {
  switch (page) {
    case 'dashboard':
      return <DashboardScreen key={page} store={store} />;
    case 'sales':
      return <SalesScreen key={page} store={store} />;
    case 'stock':
      return <StockScreen key={page} store={store} />;
    case 'reports':
      return <ReportsScreen key={page} store={store} />;
    case 'accounting':
      return <AccountingScreen key={page} store={store} />;
    case 'transactions':
      return (
        <ReportsScreen
          key={page}
          store={store}
          initialReportsSubTab="islemler"
          transactionsOnlyMenu
        />
      );
    case 'customers':
      return <AccountingScreen key={page} store={store} initialTab="musteriler" />;
    case 'cashier':
      return <AccountingScreen key={page} store={store} initialTab="kasa" />;
    case 'posta':
      return <EkolojikPostaHubScreen key={page} store={store} />;
    case 'settings':
      return <SettingsScreen key={page} store={store} />;
    default:
      return <DashboardScreen key="dashboard" store={store} />;
  }
}

export function PosApp() {
  const store = useStore();
  const [page, setPage] = useState<AppPage>('sales');
  const [postaUnread, setPostaUnread] = useState(0);

  useIdleLogout(() => {
    store.logout('idle');
  }, Boolean(store.authSession));

  useEffect(() => {
    if (!store.authSession) return;
    store.trackPageView(page);
  }, [store.authSession, page, store]);

  useEffect(() => {
    if (!store.authSession) return;
    if (!canAccessPage(store.authSession, page)) {
      setPage(getDefaultLandingPage(store.authSession));
    }
  }, [store.authSession, page]);

  useEffect(() => {
    setCurrencyDisplaySettings(store.settings.currency);
  }, [store.settings.currency]);

  useEffect(() => {
    if (!store.authSession?.allowedTabs.includes('posta')) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetchPostaUnreadCounts();
        if (!cancelled && r.ok) setPostaUnread(r.total ?? 0);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [store.authSession]);

  if (!store.authSession) {
    return <Navigate to="/giris" replace />;
  }

  if (store.authSession.mustChangePassword) {
    return <ChangePasswordModal store={store} />;
  }

  const allowedTabs = store.authSession.allowedTabs;
  const showCostProfitToggle = canRevealCostProfit(store.authSession);
  const shellPage = resolveTopNavHighlight(page, allowedTabs);

  return (
    <AppShell
      store={store}
      page={shellPage}
      allowedTabs={allowedTabs}
      onPageChange={setPage}
      onLogout={store.logout}
      onBrandSecretClick={showCostProfitToggle ? store.toggleCostProfitReveal : undefined}
      navBadgeOverrides={postaUnread > 0 ? { posta: postaUnread } : undefined}
    >
      {renderPage(page, store)}
    </AppShell>
  );
}
