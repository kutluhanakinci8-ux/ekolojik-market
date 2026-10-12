import { useEffect } from 'react';
import { APP_BUILD_ID } from '../version';

async function clearSiteCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore */
  }
}

/** Sunucuda yeni build varsa önbelleği temizleyip yeniler */
export function useAppReleaseRefresh(): void {
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/app-release.json?nocache=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (!data.buildId || data.buildId === APP_BUILD_ID) return;
        await clearSiteCaches();
        const u = new URL(window.location.href);
        u.searchParams.set('_build', data.buildId);
        window.location.replace(u.toString());
      } catch {
        /* offline */
      }
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
