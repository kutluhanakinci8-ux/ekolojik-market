import type { AppPage } from '../components/AppShell';
import { ALL_APP_PAGES, DEFAULT_CASHIER_TABS } from '../data/navigation';
import type { AppSettings } from '../types/business';
import type { AuthSession, PosUser } from '../types/user';
import {
  filterTabsForProductProfile,
  isPosLiteProfile,
  POS_LITE_ADMIN_TABS,
  POS_LITE_CASHIER_TABS,
} from './tenantProductProfile';

export interface UserTabPermissions {
  hasFullAccounting: boolean;
  hasTransactions: boolean;
  hasCashier: boolean;
  hasCustomers: boolean;
  hasReports: boolean;
}

/** Oturum menüsüne eklenen `accounting` nav bayrağını fiş yetkisine karıştırmamak için ham kullanıcı yetkileri */
export function resolveUserTabPermissions(
  user: PosUser | undefined,
  session: AuthSession | null | undefined,
  settings?: AppSettings | null,
): UserTabPermissions {
  if (!user || !session) {
    return {
      hasFullAccounting: false,
      hasTransactions: false,
      hasCashier: false,
      hasCustomers: false,
      hasReports: false,
    };
  }
  if (isPosLiteProfile(settings)) {
    const raw =
      user.role === 'admin'
        ? POS_LITE_ADMIN_TABS
        : user.allowedTabs.filter((tab) => ALL_APP_PAGES.includes(tab));
    return {
      hasFullAccounting: false,
      hasTransactions: raw.includes('transactions'),
      hasCashier: false,
      hasCustomers: false,
      hasReports: raw.includes('reports'),
    };
  }
  if (user.role === 'admin') {
    return {
      hasFullAccounting: true,
      hasTransactions: true,
      hasCashier: true,
      hasCustomers: true,
      hasReports: true,
    };
  }
  const raw = user.allowedTabs.filter((tab) => ALL_APP_PAGES.includes(tab));
  return {
    hasFullAccounting: raw.includes('accounting'),
    hasTransactions: raw.includes('transactions'),
    hasCashier: raw.includes('cashier'),
    hasCustomers: raw.includes('customers'),
    hasReports: raw.includes('reports'),
  };
}

export function resolveUserAllowedTabs(user: PosUser, settings?: AppSettings | null): AppPage[] {
  if (isPosLiteProfile(settings)) {
    if (user.role === 'admin') {
      return [...POS_LITE_ADMIN_TABS];
    }
    const allowed = user.allowedTabs.filter((tab) => ALL_APP_PAGES.includes(tab));
    const tabs = allowed.length > 0 ? allowed : [...POS_LITE_CASHIER_TABS];
    return filterTabsForProductProfile(tabs, settings);
  }
  if (user.role === 'admin') {
    return ALL_APP_PAGES;
  }
  const allowed = user.allowedTabs.filter((tab) => ALL_APP_PAGES.includes(tab));
  const tabs = allowed.length > 0 ? allowed : [...DEFAULT_CASHIER_TABS];
  const needsAccountingNav = tabs.some((tab) => tab === 'transactions' || tab === 'cashier' || tab === 'customers');
  if (needsAccountingNav && !tabs.includes('accounting')) {
    return [...tabs, 'accounting'];
  }
  return tabs;
}

export function buildAuthSession(
  user: PosUser,
  sessionId?: string,
  settings?: AppSettings | null,
): AuthSession {
  return {
    userId: user.id,
    sessionId: sessionId ?? `S${Date.now()}`,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedTabs: resolveUserAllowedTabs(user, settings),
    loggedInAt: new Date().toISOString(),
    mustChangePassword: user.mustChangePassword === true,
  };
}

export function canAccessPage(session: AuthSession | null | undefined, page: AppPage): boolean {
  if (!session) return false;
  return session.allowedTabs.includes(page);
}

export function getDefaultLandingPage(session: AuthSession): AppPage {
  if (session.allowedTabs.includes('sales')) return 'sales';
  return session.allowedTabs[0] ?? 'sales';
}

/** Gizli maliyet/kar görünümü — yönetici veya ayarlar erişimi olan kullanıcı */
export function canRevealCostProfit(session: AuthSession | null | undefined): boolean {
  if (!session) return false;
  return session.role === 'admin' || session.allowedTabs.includes('settings');
}
