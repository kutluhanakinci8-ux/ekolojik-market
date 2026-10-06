export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform || 'unknown';
  const lang = navigator.language || 'unknown';
  const screen = `${window.screen.width}x${window.screen.height}`;
  return `${platform} · ${screen} · ${lang} · ${ua.slice(0, 120)}`;
}
