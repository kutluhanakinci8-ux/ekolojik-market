export const POSTA_ONBOARDING_FORCE_KEY = 'market-pos-posta-onboarding-force';

export const POSTA_ONBOARDING_REQUEST_EVENT = 'posta-onboarding-request';

export function signalPostaOnboardingOpen(): void {
  try {
    sessionStorage.setItem(POSTA_ONBOARDING_FORCE_KEY, '1');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(POSTA_ONBOARDING_REQUEST_EVENT));
}

export function shouldForcePostaOnboardingOpen(): boolean {
  try {
    return sessionStorage.getItem(POSTA_ONBOARDING_FORCE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPostaOnboardingForce(): void {
  try {
    sessionStorage.removeItem(POSTA_ONBOARDING_FORCE_KEY);
  } catch {
    /* ignore */
  }
}
