import { createContext, useContext, type ReactNode } from 'react';

export type PlatformNavTab =
  | 'overview'
  | 'billing'
  | 'support'
  | 'tenants'
  | 'users'
  | 'security'
  | 'audit'
  | 'comms'
  | 'settings'
  | 'integrations'
  | 'infrastructure';

type PlatformNavContextValue = {
  goToTab: (tab: PlatformNavTab) => void;
};

const PlatformNavContext = createContext<PlatformNavContextValue | null>(null);

export function PlatformNavProvider({
  children,
  goToTab,
}: {
  children: ReactNode;
  goToTab: (tab: PlatformNavTab) => void;
}) {
  return <PlatformNavContext.Provider value={{ goToTab }}>{children}</PlatformNavContext.Provider>;
}

export function usePlatformNav(): PlatformNavContextValue | null {
  return useContext(PlatformNavContext);
}
