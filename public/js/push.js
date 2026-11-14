// Notificaciones: Web Push vía servidor (funciona con la app cerrada) +
// respaldo local (Periodic Background Sync y comprobación mientras la app está abierta).
import { buildSchedule } from './reminders.js';

const DATA_CACHE = 'lunara-data';
const SCHEDULE_URL = '/__schedule';

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const pushSupported = () => notificationsSupported() && 'PushManager' in window;
export const permission = () => (('Notification' in window) ? Notification.permission : 'unsupported');
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const pushStatus = { server: false, lastSync: null, error: null, scheduled: 0 };

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('No se pudo registrar el service worker', e);
    return null;
  }
}

async function getSubscription(create) {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub || !create) return sub;
  const res = await fetch('/api/vapid-public-key');
  if (!res.ok) throw new Error('Servidor push no disponible');
  const { key } = await res.json();
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  return sub;
}

/** Pide permiso y se suscribe. Devuelve { server: boolean } */
export async function enableNotifications() {
  if (!notificationsSupported()) {
    throw new Error(isIOS() && !isStandalone()
      ? 'En iPhone/iPad primero añade Lunara a la pantalla de inicio (Compartir → Añadir a inicio) y ábrela desde allí.'
      : 'Este navegador no admite notificaciones.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado. Puedes activarlo en los ajustes del navegador.');
  let server = false;
  try { server = !!(await getSubscription(true)); } catch (e) { pushStatus.error = e.message; console.warn(e); }
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) await reg.periodicSync.register('lunara-reminders', { minInterval: 6 * 60 * 60 * 1000 });
  } catch { /* no soportado o sin permiso */ }
  return { server };
}

export async function disableNotifications() {
  try {
    const sub = await getSubscription(false);
    if (sub) {
      await fetch('/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch (e) { console.warn(e); }
  writeLastSync({});
  pushStatus.server = false;
  await writeLocalSchedule({ oneOff: [], daily: [] }, false);
}

async function writeLocalSchedule(schedule, serverActive) {
  if (!('caches' in window)) return;
  const cache = await caches.open(DATA_CACHE);
  const prev = await cache.match(SCHEDULE_URL).then((r) => (r ? r.json() : {})).catch(() => ({}));
  const data = { ...schedule, serverActive, fired: prev.fired || {} };
  await cache.put(SCHEDULE_URL, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
}

// Última sincronización con el servidor: evita llamadas si la agenda no cambió.
const SYNC_KEY = 'lunara:lastSync';
const RESYNC_MS = 24 * 60 * 60 * 1000;
function readLastSync() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } }
function writeLastSync(v) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(v)); } catch { /* ignore */ } }

/** Recalcula la agenda y la envía al servidor (y al respaldo local) solo si cambió. */
export async function syncReminders(state, { force = false } = {}) {
  const schedule = buildSchedule(state);
  let serverActive = false;
  try {
    if (state.reminders.enabled && permission() === 'granted') {
      const sub = await getSubscription(true);
      if (sub) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const key = JSON.stringify([sub.endpoint, tz, schedule]);
        const last = readLastSync();
        if (!force && last.key === key && Date.now() - last.at < RESYNC_MS) {
          serverActive = true;
          pushStatus.scheduled = last.scheduled;
        } else {
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON(), tz, ...schedule }),
          });
          if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
          const json = await res.json();
          serverActive = true;
          pushStatus.scheduled = json.scheduled + json.daily;
          writeLastSync({ key, at: Date.now(), scheduled: pushStatus.scheduled });
        }
        pushStatus.error = null;
      }
    }
  } catch (e) {
    writeLastSync({});
    pushStatus.error = e.message;
    console.warn('Sincronización push fallida; se usará el modo local', e);
  }
  pushStatus.server = serverActive;
  pushStatus.lastSync = new Date();
  await writeLocalSchedule(schedule, serverActive).catch(() => {});
  return { ...pushStatus, schedule };
}

let syncTimer = null;
export function scheduleSync(state) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncReminders(state), 800);
}

/** Mientras la app está abierta, pide al SW que revise recordatorios locales. */
export function startLocalChecker() {
  if (!('serviceWorker' in navigator)) return;
  const check = () => navigator.serviceWorker.controller?.postMessage({ type: 'check' });
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setTimeout(check, 3000);
}

export async function testLocal() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Lunara 🌙', {
    body: '¡Las notificaciones funcionan! Así verás tus recordatorios.',
    icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'test', data: { url: '/#/today' },
  });
}

export async function testServer(delay = 10) {
  const sub = await getSubscription(true);
  if (!sub) throw new Error('No hay suscripción push');
  const res = await fetch('/api/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), delay, body: 'Push del servidor recibido. Llegará aunque la app esté cerrada ✅' }),
  });
  if (!res.ok) throw new Error('El servidor push no respondió');
}
