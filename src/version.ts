declare const __APP_BUILD_ID__: string;
declare const __APP_VERSION__: string;

/**
 * Mac / Windows: aynı web uygulaması (ayrı masaüstü POS sürümü yok).
 * Kaynak: package.json + vite → dist/app-release.json
 */
export const APP_RELEASE_CHANNEL = 'unified-web';

/** Her deploy’da otomatik (vite) — elle etiket yok */
export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

/** package.json — tek ürün sürüm numarası */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export function formatAppReleaseLabel(): string {
  return `${APP_VERSION} · ${APP_BUILD_ID}`;
}
