/** Canlı site — Mac/Windows aynı adres (localStorage + oturum tek kaynak) */
export const CANONICAL_SITE_ORIGIN = 'https://www.ekolojikmarket.com.tr';
export const CANONICAL_HOSTNAME = 'www.ekolojikmarket.com.tr';
export const APEX_HOSTNAME = 'ekolojikmarket.com.tr';

/** www olmayan apex → www (pathname/search/hash korunur) */
export function redirectToCanonicalWwwHost(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hostname !== APEX_HOSTNAME) return;
  const next = `${CANONICAL_SITE_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(next);
}
