import { useEffect, useRef } from 'react';
import { IDLE_LOGOUT_MS } from '../types/security';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;

export function useIdleLogout(onIdle: () => void, enabled: boolean, timeoutMs = IDLE_LOGOUT_MS): void {
  const timerRef = useRef<number | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onIdleRef.current();
      }, timeoutMs);
    };

    resetTimer();
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [enabled, timeoutMs]);
}
