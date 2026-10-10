import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
import { useStore } from './store/StoreProvider';
import { canAccessPage, canRevealCostProfit, getDefaultLandingPage } from './utils/userAccess';
import { resolveTopNavHighlight } from './data/navigation';
import type { AppPage } from './components/AppShell';
import { fetchPostaUnreadCounts } from './services/postaInboxService';
import { postaEventsStreamUrl } from './services/posHubFetch';
import { PostaOnboardingWizard } from './components/onboarding/PostaOnboardingWizard';
import { fetchPostaOnboardingHub } from './services/postaOnboardingService';
import {
  clearPostaOnboardingForce,
  POSTA_ONBOARDING_REQUEST_EVENT,
  shouldForcePostaOnboardingOpen,
} from './storage/postaOnboardingSession';
import { filterTabsForProductProfile, isPosLiteProfile } from './utils/tenantProductProfile';
import { PosTenantBootstrap } from './components/PosTenantBootstrap';

function renderPage(
  page: AppPage,
  store: ReturnType<typeof useStore>,
  postaDeepLink?: { customerId: string | null; onConsumed: () => void },
) {
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
      return (
        <EkolojikPostaHubScreen
          key={`${page}-${postaDeepLink?.customerId ?? ''}`}
          store={store}
          deepLinkCustomerId={postaDeepLink?.customerId ?? null}
          onDeepLinkConsumed={postaDeepLink?.onConsumed}
        />
      );
    case 'settings':
      return <SettingsScreen key={page} store={store} />;
    default:
      return <DashboardScreen key="dashboard" store={store} />;
  }
}

export function PosApp() {
  const store = useStore();
  const allowedTabs = store.authSession
    ? filterTabsForProductProfile(store.authSession.allowedTabs, store.settings)
    : [];
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState<AppPage>('sales');
  const [postaUnread, setPostaUnread] = useState(0);
  const [postaOnboardingOpen, setPostaOnboardingOpen] = useState(false);
  const deepLinkCustomerId = searchParams.get('customerId')?.trim() || null;
  const viewPosta = searchParams.get('view') === 'posta' || Boolean(deepLinkCustomerId);

  const clearPostaDeepLink = () => {
    if (!searchParams.get('customerId') && searchParams.get('view') !== 'posta') return;
    const next = new URLSearchParams(searchParams);
    next.delete('customerId');
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!store.authSession || !viewPosta) return;
    if (allowedTabs.includes('posta')) {
      setPage('posta');
    }
  }, [store.authSession, viewPosta, allowedTabs]);

  useIdleLogout(() => {
    store.logout('idle');
  }, Boolean(store.authSession));

  useEffect(() => {
    if (!store.authSession) return;
    store.trackPageView(page);
  }, [store.authSession, page, store]);

  useEffect(() => {
    if (!store.authSession) return;
    const session = { ...store.authSession, allowedTabs };
    if (!canAccessPage(session, page)) {
      setPage(getDefaultLandingPage(session));
    }
  }, [store.authSession, page, allowedTabs]);

  useEffect(() => {
    setCurrencyDisplaySettings(store.settings.currency);
  }, [store.settings.currency]);

  const evaluatePostaOnboardingGate = useCallback(async () => {
    if (isPosLiteProfile(store.settings)) return;
    if (!store.authSession || store.authSession.role !== 'admin') return;
    if (shouldForcePostaOnboardingOpen()) {
      setPostaOnboardingOpen(true);
      return;
    }
    const hub = await fetchPostaOnboardingHub();
    if (!hub) return;
    const status = hub.onboarding.status;
    if (status === 'pending' || status === 'in_progress') {
      setPostaOnboardingOpen(true);
      return;
    }
    if (status !== 'completed' && status !== 'dismissed') {
      setPostaOnboardingOpen(true);
    }
  }, [store.authSession, store.settings]);

  useEffect(() => {
    void evaluatePostaOnboardingGate();
  }, [evaluatePostaOnboardingGate]);

  useEffect(() => {
    const onRequest = () => {
      void evaluatePostaOnboardingGate();
    };
    window.addEventListener(POSTA_ONBOARDING_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(POSTA_ONBOARDING_REQUEST_EVENT, onRequest);
  }, [evaluatePostaOnboardingGate]);

  useEffect(() => {
    if (!allowedTabs.includes('posta')) return;
    let cancelled = false;
    const applyCounts = (total?: number) => {
      if (!cancelled && total != null) setPostaUnread(total);
    };
    const poll = async () => {
      try {
        const r = await fetchPostaUnreadCounts();
        if (r.ok) applyCounts(r.total ?? 0);
      } catch {
        /* ignore */
      }
    };
    void poll();
    let es: EventSource | null = null;
    try {
      es = new EventSource(postaEventsStreamUrl());
      es.addEventListener('unread', (ev) => {
        try {
          const data = JSON.parse(String((ev as MessageEvent).data)) as { total?: number };
          applyCounts(data.total ?? 0);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
      };
    } catch {
      es = null;
    }
    const id = window.setInterval(poll, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      es?.close();
    };
  }, [store.authSession, allowedTabs]);

  if (!store.authSession) {
    return <Navigate to="/giris" replace />;
  }

  if (!store.catalogDisplayReady) {
    return <PosTenantBootstrap settings={store.settings} />;
  }

  if (store.authSession.mustChangePassword) {
    return <ChangePasswordModal store={store} />;
  }

  if (postaOnboardingOpen) {
    return (
      <PostaOnboardingWizard
        store={store}
        onFinished={() => {
          clearPostaOnboardingForce();
          setPostaOnboardingOpen(false);
        }}
      />
    );
  }

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
      {renderPage(page, store, {
        customerId: page === 'posta' ? deepLinkCustomerId : null,
        onConsumed: clearPostaDeepLink,
      })}
    </AppShell>
  );
}
