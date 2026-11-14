import { getState, subscribe } from './store.js';
import { registerSW, scheduleSync, startLocalChecker, syncReminders, isStandalone } from './push.js';
import * as install from './views/install.js';
import * as today from './views/today.js';
import * as calendar from './views/calendar.js';
import * as log from './views/log.js';
import * as insights from './views/insights.js';
import * as settings from './views/settings.js';
import * as onboarding from './views/onboarding.js';
import * as lock from './views/lock.js';

const routes = { today, calendar, log, insights, settings };
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let unlocked = false;
let lastRoute = '';
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function applyTheme() {
  const t = getState().settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

function parseRoute() {
  const [, name = 'today', ...params] = (location.hash || '#/today').split('/');
  return { name: routes[name] ? name : 'today', params };
}

function mount(v, routeKey) {
  const same = routeKey === lastRoute;
  const y = window.scrollY;
  view.innerHTML = v.html;
  v.bind?.(view);
  window.scrollTo(0, same ? y : 0);
  lastRoute = routeKey;
}

export function render() {
  const s = getState();
  applyTheme();
  if (s.settings.pinHash && !unlocked) {
    tabbar.hidden = true;
    mount(lock.render({ onUnlock: () => { unlocked = true; render(); } }), 'lock');
    return;
  }
  if (!s.onboarded && !isStandalone() && !install.installChoiceMade()) {
    tabbar.hidden = true;
    mount(install.render(), 'install');
    return;
  }
  if (!s.onboarded) {
    tabbar.hidden = true;
    mount(onboarding.render(), 'onboarding');
    return;
  }
  tabbar.hidden = false;
  const { name, params } = parseRoute();
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
  mount(routes[name].render(params), `${name}/${params.join('/')}`);
}

subscribe((s) => {
  render();
  if (s.onboarded) scheduleSync(s);
});
window.addEventListener('hashchange', render);
window.addEventListener('rerender', render);

// Instalación de la PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.lunaraInstall = e;
  render();
});
window.addEventListener('appinstalled', () => { window.lunaraInstall = null; install.markInstalled(); render(); });

// Clic en una notificación con la app abierta
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'navigate') {
    const hash = e.data.url.split('#')[1];
    if (hash) location.hash = hash;
  }
});

// Bloqueo con PIN al volver tras un rato en segundo plano
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (getState().settings.pinHash && hiddenAt && Date.now() - hiddenAt > 60_000) { unlocked = false; render(); }
});

(async function init() {
  render();
  await registerSW();
  startLocalChecker();
  const s = getState();
  if (s.onboarded && s.reminders.enabled) syncReminders(s).then(() => { if (location.hash.startsWith('#/settings')) render(); });
})();
