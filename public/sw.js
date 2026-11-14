// Service worker de Lunara: offline, notificaciones push y recordatorios locales de respaldo.
const VERSION = 'v1.2.0';
const CACHE = `lunara-${VERSION}`;
const DATA_CACHE = 'lunara-data';
const SCHEDULE_URL = '/__schedule';
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest', '/css/styles.css',
  '/js/app.js', '/js/store.js', '/js/dates.js', '/js/cycle.js', '/js/catalog.js', '/js/reminders.js',
  '/js/push.js', '/js/ui.js', '/js/icons.js',
  '/js/views/today.js', '/js/views/calendar.js', '/js/views/log.js', '/js/views/insights.js',
  '/js/views/settings.js', '/js/views/onboarding.js', '/js/views/lock.js', '/js/views/install.js',
  '/icons/favicon.svg', '/icons/logo.svg', '/icons/sprite.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png',
  '/icons/apple-touch-icon.png', '/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lunara-v') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  // stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});

// ---------- Notificaciones ----------
function show(item) {
  const options = {
    body: item.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: item.tag || 'lunara',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: item.url || '/#/today' },
    timestamp: Date.now(),
  };
  if (item.tag && /^(period|pill|log|bbt|water)/.test(item.tag)) {
    options.actions = [{ action: 'log', title: 'Registrar' }, { action: 'dismiss', title: 'Más tarde' }];
  }
  return self.registration.showNotification(item.title || 'Lunara', options);
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(show({ title: data.title || 'Lunara', body: data.body || 'Tienes un recordatorio', tag: data.tag, url: data.url }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const target = event.action === 'log' ? '/#/log' : (event.notification.data && event.notification.data.url) || '/#/today';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (new URL(client.url).origin === location.origin) {
        await client.focus();
        client.postMessage({ type: 'navigate', url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

// ---------- Respaldo local (sin servidor push) ----------
function localParts(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return { date: `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`, minutes: date.getHours() * 60 + date.getMinutes() };
}
async function checkLocalSchedule() {
  const cache = await caches.open(DATA_CACHE);
  const res = await cache.match(SCHEDULE_URL);
  if (!res) return;
  const data = await res.json();
  if (data.serverActive) return; // el servidor se encarga
  const fired = data.fired || {};
  const now = Date.now();
  const { date, minutes } = localParts();
  const pending = [];
  for (const it of data.oneOff || []) {
    if (it.at <= now && now - it.at < 24 * 3600e3 && !fired[it.id]) { fired[it.id] = now; pending.push(it); }
  }
  for (const it of data.daily || []) {
    const [h, m] = it.time.split(':').map(Number);
    const diff = minutes - (h * 60 + m);
    const key = `${it.id}@${date}`;
    if (diff >= 0 && diff < 180 && !fired[key]) { fired[key] = now; pending.push(it); }
  }
  // limpia marcas antiguas
  for (const k of Object.keys(fired)) if (now - fired[k] > 3 * 24 * 3600e3) delete fired[k];
  data.fired = fired;
  await cache.put(SCHEDULE_URL, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  await Promise.all(pending.map(show));
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'lunara-reminders') event.waitUntil(checkLocalSchedule());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'check') event.waitUntil(checkLocalSchedule());
  if (msg.type === 'show') event.waitUntil(show(msg.item));
});
