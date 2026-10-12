import { useEffect } from 'react';
import { APP_BUILD_ID } from '../version';

/** Sunucuda yeni build varsa sayfayı yeniler — kullanıcıya «hangi sürüm» demeye gerek kalmaz */
export function useAppReleaseRefresh(): void {
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/app-release.json?nocache=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (data.buildId && data.buildId !== APP_BUILD_ID) {
          window.location.reload();
        }
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
