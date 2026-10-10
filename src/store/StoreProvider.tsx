import { createContext, useContext, type ReactNode } from 'react';
import { usePosStoreState, type Store } from './useStore';

const StoreContext = createContext<Store | null>(null);

/** Tek paylaşımlı store — /giris ve /app ayrı hook state kullanmaz (katalog flaşı önlenir). */
export function StoreProvider({ children }: { children: ReactNode }) {
  const value = usePosStoreState();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return store;
}
