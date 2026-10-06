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
import { useIdleLogout } from './hooks/useIdleLogout';
import { useStore } from './store/useStore';
import { canAccessPage, canRevealCostProfit, getDefaultLandingPage } from './utils/userAccess';
import type { AppPage } from './components/AppShell';

function renderPage(page: AppPage, store: ReturnType<typeof useStore>) {
  switch (page) {
    case 'dashboard':
      return <DashboardScreen store={store} />;
    case 'sales':
      return <SalesScreen store={store} />;
    case 'stock':
      return <StockScreen store={store} />;
    case 'reports':
      return <ReportsScreen store={store} />;
    case 'accounting':
      return <AccountingScreen store={store} />;
    case 'transactions':
      return <ReportsScreen store={store} initialReportsSubTab="islemler" />;
    case 'customers':
      return <AccountingScreen store={store} initialTab="musteriler" />;
    case 'cashier':
      return <AccountingScreen store={store} initialTab="kasa" />;
    case 'settings':
      return <SettingsScreen store={store} />;
    default:
      return <DashboardScreen store={store} />;
  }
}

export function PosApp() {
  const store = useStore();
  const [page, setPage] = useState<AppPage>('sales');

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

  if (!store.authSession) {
    return <Navigate to="/giris" replace />;
  }

  if (store.authSession.mustChangePassword) {
    return <ChangePasswordModal store={store} />;
  }

  const allowedTabs = store.authSession.allowedTabs;
  const showCostProfitToggle = canRevealCostProfit(store.authSession);
  const shellPage = page === 'transactions'
    ? 'reports'
    : page === 'cashier' || page === 'customers'
      ? 'accounting'
      : page;

  return (
    <AppShell
      store={store}
      page={shellPage}
      allowedTabs={allowedTabs}
      onPageChange={setPage}
      onLogout={store.logout}
      onBrandSecretClick={showCostProfitToggle ? store.toggleCostProfitReveal : undefined}
    >
      {renderPage(page, store)}
    </AppShell>
  );
}
