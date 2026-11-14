// Pantalla previa al onboarding: instalar la app o continuar en el navegador.
import { isIOS } from '../push.js';
import { toast } from '../ui.js';

const CHOICE_KEY = 'lunara:installChoice';
let mode = 'offer'; // offer | help | installed
const rerender = () => window.dispatchEvent(new Event('rerender'));

export function markInstalled() { mode = 'installed'; }

export function installChoiceMade() {
  try { return localStorage.getItem(CHOICE_KEY) === 'browser'; } catch { return false; }
}
function continueInBrowser() {
  try { localStorage.setItem(CHOICE_KEY, 'browser'); } catch { /* ignore */ }
  rerender();
}

// Iconos simples para las instrucciones
const IC = {
  share: '<svg class="ic" viewBox="0 0 24 24" aria-label="Compartir"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>',
  dots: '<svg class="ic" viewBox="0 0 24 24" aria-label="Menú"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  hdots: '<svg class="ic" viewBox="0 0 24 24" aria-label="Menú"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  burger: '<svg class="ic" viewBox="0 0 24 24" aria-label="Menú"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24" aria-label="Añadir"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  install: '<svg class="ic" viewBox="0 0 24 24" aria-label="Instalar"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 7v6M9 10l3 3 3-3M8 21h8"/></svg>',
};

export function detectPlatform() {
  const ua = navigator.userAgent;
  const ios = isIOS();
  const android = /android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  const firefox = /Firefox|FxiOS/i.test(ua);
  const edge = /Edg(e|A|iOS)?\//i.test(ua);
  const opera = /OPR\/|Opera|OPiOS/i.test(ua);
  const chrome = /Chrome|CriOS/i.test(ua) && !edge && !samsung && !opera;
  const safari = /Safari/i.test(ua) && !chrome && !firefox && !edge && !opera && !samsung;
  const mac = /Macintosh/i.test(ua) && !ios;
  return { ios, android, inApp, samsung, firefox, edge, opera, chrome, safari, mac, desktop: !ios && !android };
}

export function installHelp(p = detectPlatform()) {
  if (p.inApp) {
    return {
      title: 'Abre Lunara en tu navegador',
      steps: [
        `Toca el menú ${p.ios ? IC.hdots : IC.dots} de esta pantalla (arriba o abajo a la derecha).`,
        `Elige <b>${p.ios ? 'Abrir en Safari' : 'Abrir en Chrome'}</b> (o “Abrir en el navegador”).`,
        'Desde allí podrás instalar la app.',
      ],
      note: 'Los navegadores integrados en Instagram, Facebook o TikTok no permiten instalar apps.',
      copy: true,
    };
  }
  if (p.ios) {
    if (p.safari) {
      return {
        title: 'Instalar en iPhone / iPad',
        steps: [
          `Toca el botón <b>Compartir</b> ${IC.share} en la barra de Safari.`,
          `Desliza y elige <b>Añadir a pantalla de inicio</b> ${IC.plus}.`,
          'Toca <b>Añadir</b> y abre Lunara desde el nuevo icono.',
        ],
        note: 'En iPhone las notificaciones solo funcionan si abres Lunara desde la pantalla de inicio (iOS 16.4 o posterior).',
      };
    }
    return {
      title: 'Instalar en iPhone / iPad',
      steps: [
        `Toca el botón <b>Compartir</b> ${IC.share} (en la barra de direcciones o en el menú ${IC.hdots}).`,
        `Elige <b>Añadir a pantalla de inicio</b> ${IC.plus} y confirma.`,
        'Abre Lunara desde el nuevo icono.',
      ],
      note: 'Si no ves la opción, abre esta página en <b>Safari</b> y repite los pasos. Las notificaciones requieren iOS 16.4 o posterior.',
      copy: true,
    };
  }
  if (p.android) {
    if (p.samsung) {
      return {
        title: 'Instalar en Samsung Internet',
        steps: [`Toca el menú ${IC.burger} abajo a la derecha.`, 'Elige <b>Añadir página a</b> → <b>Pantalla de inicio</b>.', 'Confirma con <b>Añadir</b>.'],
      };
    }
    if (p.firefox) {
      return {
        title: 'Instalar en Firefox',
        steps: [`Toca el menú ${IC.dots}.`, 'Elige <b>Instalar</b> (o “Añadir a pantalla de inicio”).', 'Confirma con <b>Añadir</b>.'],
      };
    }
    return {
      title: 'Instalar en Android',
      steps: [`Toca el menú ${IC.dots} arriba a la derecha.`, 'Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.', 'Confirma con <b>Instalar</b>.'],
      note: 'Si no aparece la opción, recarga la página y espera unos segundos.',
    };
  }
  if (p.mac && p.safari) {
    return {
      title: 'Instalar en Mac (Safari)',
      steps: ['En la barra de menús elige <b>Archivo</b>.', 'Selecciona <b>Añadir al Dock</b>.', 'Confirma con <b>Añadir</b>.'],
      note: 'Requiere macOS Sonoma o posterior.',
    };
  }
  if (p.firefox) {
    return {
      title: 'Firefox de escritorio no instala apps',
      steps: ['Abre esta página en <b>Chrome</b> o <b>Edge</b> para instalarla.', 'O continúa en el navegador: todo funciona igual.'],
      copy: true,
    };
  }
  if (p.edge) {
    return {
      title: 'Instalar en Edge',
      steps: [`Haz clic en el icono ${IC.install} de la barra de direcciones.`, `O abre el menú ${IC.hdots} → <b>Aplicaciones</b> → <b>Instalar este sitio como aplicación</b>.`, 'Confirma con <b>Instalar</b>.'],
    };
  }
  return {
    title: 'Instalar en el ordenador',
    steps: [`Haz clic en el icono ${IC.install} de la barra de direcciones.`, `O abre el menú ${IC.dots} → <b>Transmitir, guardar y compartir</b> → <b>Instalar Lunara</b>.`, 'Confirma con <b>Instalar</b>.'],
  };
}

async function tryInstall() {
  const ev = window.lunaraInstall;
  if (!ev) { mode = 'help'; rerender(); return; }
  ev.prompt();
  const { outcome } = await ev.userChoice;
  window.lunaraInstall = null;
  mode = outcome === 'accepted' ? 'installed' : 'offer';
  if (outcome !== 'accepted') toast('Puedes instalarla cuando quieras desde Perfil');
  rerender();
}

export function render() {
  const p = detectPlatform();
  let body;
  if (mode === 'installed') {
    body = `
      <div class="ob-hero">🎉</div>
      <h1>¡Lunara está instalada!</h1>
      <p class="muted">Ábrela desde tu ${p.desktop ? 'escritorio o menú de aplicaciones' : 'pantalla de inicio'} para empezar. Así recibirás tus recordatorios como cualquier otra app.</p>
      <div class="install-app-icon"><img src="/icons/icon-192.png" alt="" width="72" height="72"><span>Lunara</span></div>`;
  } else if (mode === 'help') {
    const h = installHelp(p);
    body = `
      <h1>${h.title}</h1>
      <ol class="install-steps">${h.steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
      ${h.note ? `<p class="status">${h.note}</p>` : ''}
      ${h.copy ? '<button class="btn secondary" data-act="copy">Copiar enlace</button>' : ''}`;
  } else {
    body = `
      <div class="install-app-icon big"><img src="/icons/icon-192.png" alt="" width="96" height="96"></div>
      <h1>Instala Lunara</h1>
      <p class="muted">Para la mejor experiencia, instálala en tu ${p.desktop ? 'ordenador' : 'teléfono'}. Es gratis, ocupa muy poco y no necesitas ninguna tienda de apps.</p>
      <ul class="benefits">
        <li><span>🔔</span><div><b>Recordatorios</b><small>Avisos de tu periodo, ventana fértil y píldora${p.ios ? ' (en iPhone solo funcionan con la app instalada)' : ''}.</small></div></li>
        <li><span>⚡</span><div><b>Acceso rápido</b><small>Desde tu ${p.desktop ? 'escritorio' : 'pantalla de inicio'}, a pantalla completa.</small></div></li>
        <li><span>✈️</span><div><b>Sin conexión</b><small>Registra tus días aunque no tengas internet.</small></div></li>
      </ul>
      ${p.ios ? '<p class="status warn">En iPhone, la app instalada guarda sus datos aparte de Safari: instálala antes de empezar para no perder tu registro.</p>' : ''}`;
  }

  const actions = mode === 'installed'
    ? '<button class="btn ghost block" data-act="browser">Continuar en el navegador</button>'
    : mode === 'help'
      ? `${window.lunaraInstall ? '<button class="btn primary block" data-act="install">Instalar ahora</button>' : ''}
         <button class="btn ghost block" data-act="back">Volver</button>
         <button class="btn ghost block" data-act="browser">Continuar en el navegador</button>`
      : `<button class="btn primary block" data-act="install">📲 Instalar app</button>
         <button class="btn ghost block" data-act="browser">Continuar en el navegador</button>`;

  return {
    html: `<div class="onboarding install-gate"><div class="ob-body">${body}</div><div class="ob-actions">${actions}</div></div>`,
    bind(root) {
      root.querySelector('[data-act=install]')?.addEventListener('click', tryInstall);
      root.querySelector('[data-act=browser]')?.addEventListener('click', continueInBrowser);
      root.querySelector('[data-act=back]')?.addEventListener('click', () => { mode = 'offer'; rerender(); });
      root.querySelector('[data-act=copy]')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(location.origin); toast('Enlace copiado. Pégalo en tu navegador'); }
        catch { toast(location.origin, 5000); }
      });
    },
  };
}
