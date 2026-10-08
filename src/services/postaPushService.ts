import { posHubFetch } from './posHubFetch';

export type PostaPushConfig = {
  ok: boolean;
  configured?: boolean;
  publicKey?: string | null;
  subject?: string | null;
  hint?: string | null;
  error?: string;
};

export type PostaPushStatus = {
  ok: boolean;
  configured?: boolean;
  subscribers?: number;
  error?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function fetchPostaPushConfig(): Promise<PostaPushConfig> {
  const res = await posHubFetch('/api/posta/push/config');
  return res.json();
}

export async function fetchPostaPushStatus(): Promise<PostaPushStatus> {
  const res = await posHubFetch('/api/posta/push/status');
  return res.json();
}

export async function subscribePostaWebPush(publicKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Tarayıcı push desteklemiyor' };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Bildirim izni verilmedi' };
  }
  const reg = await navigator.serviceWorker.register('/posta-offline-sw.js');
  await reg.update().catch(() => undefined);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const res = await posHubFetch('/api/posta/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return res.json();
}

export async function unsubscribePostaWebPush(): Promise<{ ok: boolean; error?: string }> {
  const reg = await navigator.serviceWorker.getRegistration('/posta-offline-sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  await posHubFetch('/api/posta/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  await sub.unsubscribe();
  return { ok: true };
}

export async function sendPostaPushTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const res = await posHubFetch('/api/posta/push/test', { method: 'POST' });
  return res.json();
}
