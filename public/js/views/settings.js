import { getState, update, replaceState, resetAll } from '../store.js';
import { todayKey, isValidKey } from '../dates.js';
import { REMINDER_INFO } from '../reminders.js';
import {
  enableNotifications, disableNotifications, syncReminders, testLocal, testServer,
  permission, pushStatus, isIOS, isStandalone, notificationsSupported,
} from '../push.js';
import { esc, toast, modal, confirmDialog, sha256 } from '../ui.js';
import { icon, badge } from '../icons.js';

let scrolledTo = null;
const rerender = () => window.dispatchEvent(new Event('rerender'));

function notifStatus(s) {
  const perm = permission();
  if (!notificationsSupported()) {
    return isIOS() && !isStandalone()
      ? '<p class="status warn">En iPhone/iPad, añade Lunara a la pantalla de inicio (Compartir → Añadir a inicio) y ábrela desde allí para activar notificaciones.</p>'
      : '<p class="status warn">Este navegador no admite notificaciones.</p>';
  }
  if (perm === 'denied') return '<p class="status warn">Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador para este sitio.</p>';
  if (!s.reminders.enabled) return '<p class="status">Notificaciones desactivadas.</p>';
  if (pushStatus.server) return `<p class="status ok">${icon('circle-check')} Push activo: recibirás avisos aunque la app esté cerrada${pushStatus.scheduled ? ` · ${pushStatus.scheduled} programados` : ''}.</p>`;
  if (pushStatus.lastSync) return `<p class="status warn">Modo local: los avisos llegan cuando el navegador lo permite (servidor push no disponible${pushStatus.error ? `: ${esc(pushStatus.error)}` : ''}).</p>`;
  return '<p class="status">Sincronizando…</p>';
}

function reminderRow(s, info) {
  const r = s.reminders[info.key];
  let extra = '';
  if (info.key === 'periodBefore') {
    extra = `<select data-rem="${info.key}" data-prop="days">${[1, 2, 3, 4, 5, 7].map((n) => `<option value="${n}" ${r.days === n ? 'selected' : ''}>${n} ${n === 1 ? 'día' : 'días'} antes</option>`).join('')}</select>`;
  } else if (info.time) {
    extra = `<input type="time" data-rem="${info.key}" data-prop="time" value="${r.time}">`;
  } else if (info.times) {
    extra = `<div class="times">${r.times.map((tm, i) => `<input type="time" data-rem="${info.key}" data-prop="times" data-i="${i}" value="${tm}">`).join('')}</div>`;
  }
  return `
  <li class="rem ${r.on ? '' : 'off'}">
    <div class="rem-main">
      <div><b>${info.title}</b><small>${info.desc}</small></div>
      <label class="switch"><input type="checkbox" data-rem="${info.key}" data-prop="on" ${r.on ? 'checked' : ''}><span></span></label>
    </div>
    ${r.on && extra ? `<div class="rem-extra">${extra}</div>` : ''}
  </li>`;
}

function relevantReminders(goal) {
  if (goal === 'pregnant') return REMINDER_INFO.filter((i) => ['pregnancyWeekly', 'logDaily', 'water'].includes(i.key));
  return REMINDER_INFO.filter((i) => i.key !== 'pregnancyWeekly');
}

export function render(params = []) {
  const s = getState();
  const p = s.profile;
  const r = s.reminders;

  return {
    html: `
    <header class="topbar"><div><p class="eyebrow">Perfil y ajustes</p><h1>${p.name ? esc(p.name) : 'Mi perfil'}</h1></div></header>

    <a class="card link-card" href="#/guide">
      ${badge('book-open')}
      <span><b>Guía de uso</b><small>Aprende a usar Lunara paso a paso</small></span>
      ${icon('chevron-right')}
    </a>

    <section class="card">
      <h2>Mi objetivo</h2>
      <div class="seg-ctl">
        ${[['track', 'droplet', 'Seguir mi ciclo'], ['conceive', 'flower-2', 'Quedar embarazada'], ['pregnant', 'baby', 'Estoy embarazada']]
          .map(([v, ic, l]) => `<button type="button" data-goal="${v}" class="${p.goal === v ? 'on' : ''}">${icon(ic)} ${l}</button>`).join('')}
      </div>
      ${p.goal === 'pregnant' ? `
        <label class="field">Fecha de inicio de la última regla
          <input type="date" data-preg="lmp" max="${todayKey()}" value="${s.pregnancy.lmp || ''}"></label>` : ''}
    </section>

    <section class="card">
      <h2>Datos del ciclo</h2>
      <label class="field">Nombre (opcional)<input type="text" maxlength="30" data-profile="name" value="${esc(p.name)}" placeholder="¿Cómo te llamamos?"></label>
      <div class="grid2">
        <label class="field">Duración del ciclo<input type="number" min="18" max="60" data-profile="cycleLength" value="${p.cycleLength}"><small>días</small></label>
        <label class="field">Duración del periodo<input type="number" min="1" max="12" data-profile="periodLength" value="${p.periodLength}"><small>días</small></label>
        <label class="field">Fase lútea<input type="number" min="9" max="18" data-profile="lutealLength" value="${p.lutealLength}"><small>días (normalmente 14)</small></label>
      </div>
      <p class="muted small">Cuando registras periodos, Lunara usa tus datos reales para ajustar las predicciones.</p>
    </section>

    <section class="card" id="notifications">
      <div class="card-head"><h2 class="h-ic">${icon('bell')} Notificaciones</h2>
        <label class="switch"><input type="checkbox" data-act="notif" ${r.enabled ? 'checked' : ''}><span></span></label>
      </div>
      ${notifStatus(s)}
      ${r.enabled ? `
        <label class="field inline">Hora de los avisos del ciclo<input type="time" data-act="time" value="${r.time}"></label>
        <ul class="rems">${relevantReminders(p.goal).map((i) => reminderRow(s, i)).join('')}</ul>
        <div class="rem-main discreet">
          <div><b class="h-ic">${icon('eye-off')} Modo discreto</b><small>Las notificaciones no muestran detalles (“Tienes un recordatorio nuevo”).</small></div>
          <label class="switch"><input type="checkbox" data-act="discreet" ${s.settings.discreet ? 'checked' : ''}><span></span></label>
        </div>
        <div class="row wrap">
          <button class="btn secondary" data-act="test-local">Probar notificación</button>
          <button class="btn ghost" data-act="test-server">Probar push (10 s)</button>
        </div>
        <p class="muted small">Con “Probar push” puedes cerrar la app: la notificación llegará en 10 segundos desde el servidor.</p>` : ''}
    </section>

    <section class="card">
      <h2 class="h-ic">${icon('lock')} Privacidad</h2>
      <p class="muted small">Tus registros de salud se guardan solo en este dispositivo. Al servidor solo llega la agenda de recordatorios.</p>
      <div class="row wrap">
        ${s.settings.pinHash
          ? '<button class="btn secondary" data-act="pin">Cambiar PIN</button><button class="btn ghost" data-act="pin-off">Quitar PIN</button>'
          : '<button class="btn secondary" data-act="pin">Proteger con PIN</button>'}
      </div>
    </section>

    <section class="card">
      <h2 class="h-ic">${icon('palette')} Apariencia</h2>
      <div class="seg-ctl">
        ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button type="button" data-theme="${v}" class="${s.settings.theme === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2 class="h-ic">${icon('database')} Mis datos</h2>
      <div class="row wrap">
        <button class="btn secondary" data-act="export">Exportar copia</button>
        <label class="btn secondary">Importar copia<input type="file" accept="application/json,.json" data-act="import" hidden></label>
        <button class="btn danger" data-act="wipe">Borrar todo</button>
      </div>
    </section>

    ${!isStandalone() && window.lunaraInstall ? `<div class="center-actions"><button class="btn primary" data-act="install">${icon('download')} Instalar Lunara</button></div>` : ''}
    <p class="disclaimer">Lunara · v1.0 — Las predicciones son estimaciones basadas en tus datos y no sustituyen el consejo médico ni un método anticonceptivo.</p>
    `,
    bind(root) {
      if (params[0] === 'notifications' && scrolledTo !== 'notifications') {
        scrolledTo = 'notifications';
        setTimeout(() => root.querySelector('#notifications')?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => update((st) => { st.profile.goal = b.dataset.goal; })));
      root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => update((st) => { st.settings.theme = b.dataset.theme; })));
      root.querySelector('[data-preg=lmp]')?.addEventListener('change', (e) => {
        if (isValidKey(e.target.value)) update((st) => { st.pregnancy.lmp = e.target.value; });
      });
      root.querySelectorAll('[data-profile]').forEach((input) => input.addEventListener('change', () => {
        const k = input.dataset.profile;
        if (k === 'name') { update((st) => { st.profile.name = input.value.trim(); }); return; }
        const v = Number(input.value);
        if (!Number.isInteger(v) || v < Number(input.min) || v > Number(input.max)) { toast(`Introduce un valor entre ${input.min} y ${input.max}`); input.value = p[k]; return; }
        update((st) => { st.profile[k] = v; });
      }));

      // Notificaciones
      root.querySelector('[data-act=notif]').addEventListener('change', async (e) => {
        if (e.target.checked) {
          try {
            const { server } = await enableNotifications();
            update((st) => { st.reminders.enabled = true; });
            const res = await syncReminders(getState(), { force: true });
            toast(server && res.server ? '¡Notificaciones activadas!' : 'Notificaciones activadas en modo local');
            rerender();
          } catch (err) {
            e.target.checked = false;
            toast(err.message, 5000);
          }
        } else {
          await disableNotifications();
          update((st) => { st.reminders.enabled = false; });
          toast('Notificaciones desactivadas');
        }
      });
      root.querySelector('[data-act=time]')?.addEventListener('change', (e) => { if (e.target.value) update((st) => { st.reminders.time = e.target.value; }); });
      root.querySelector('[data-act=discreet]')?.addEventListener('change', (e) => update((st) => { st.settings.discreet = e.target.checked; }));
      root.querySelectorAll('[data-rem]').forEach((el) => el.addEventListener('change', () => {
        const { rem, prop, i } = el.dataset;
        update((st) => {
          const target = st.reminders[rem];
          if (prop === 'on') target.on = el.checked;
          else if (prop === 'days') target.days = Number(el.value);
          else if (prop === 'time' && el.value) target.time = el.value;
          else if (prop === 'times' && el.value) target.times[Number(i)] = el.value;
        });
      }));
      root.querySelector('[data-act=test-local]')?.addEventListener('click', async () => {
        try { await testLocal(); } catch (err) { toast(err.message); }
      });
      root.querySelector('[data-act=test-server]')?.addEventListener('click', async () => {
        try { await testServer(10); toast('Push enviado: llegará en 10 segundos'); } catch (err) { toast(err.message, 4000); }
      });

      // PIN
      root.querySelector('[data-act=pin]')?.addEventListener('click', () => {
        modal(`
          <h2>PIN de acceso</h2>
          <p class="muted small">Elige un PIN de 4 a 6 dígitos. Si lo olvidas tendrás que borrar los datos del navegador.</p>
          <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="pin-input" data-pin="a" placeholder="Nuevo PIN" autocomplete="new-password">
          <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="pin-input" data-pin="b" placeholder="Repite el PIN" autocomplete="new-password">
          <div class="row-end"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-act="save">Guardar</button></div>`,
        (m, close) => {
          m.querySelector('[data-pin=a]').focus();
          m.querySelector('[data-act=save]').onclick = async () => {
            const a = m.querySelector('[data-pin=a]').value, b = m.querySelector('[data-pin=b]').value;
            if (!/^\d{4,6}$/.test(a)) { toast('El PIN debe tener de 4 a 6 dígitos'); return; }
            if (a !== b) { toast('Los PIN no coinciden'); return; }
            const hash = await sha256(`lunara:${a}`);
            update((st) => { st.settings.pinHash = hash; });
            close(); toast('PIN activado');
          };
        });
      });
      root.querySelector('[data-act=pin-off]')?.addEventListener('click', async () => {
        if (await confirmDialog('¿Quitar el PIN de acceso?', 'Quitar')) update((st) => { st.settings.pinHash = null; });
      });

      // Datos
      root.querySelector('[data-act=export]').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ app: 'lunara', exportedAt: new Date().toISOString(), data: getState() }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lunara-copia-${todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      root.querySelector('[data-act=import]').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const json = JSON.parse(await file.text());
          const data = json.data || json;
          if (!Array.isArray(data.periodDays) || typeof data.logs !== 'object') throw new Error();
          data.periodDays = data.periodDays.filter(isValidKey);
          if (await confirmDialog('Esto reemplazará tus datos actuales con los de la copia. ¿Continuar?', 'Importar')) {
            replaceState(data); toast('Copia importada');
          }
        } catch { toast('El archivo no es una copia válida de Lunara'); }
        e.target.value = '';
      });
      root.querySelector('[data-act=wipe]').addEventListener('click', async () => {
        if (await confirmDialog('Se borrarán todos tus registros de este dispositivo. Esta acción no se puede deshacer.', 'Borrar todo', true)) {
          await disableNotifications();
          resetAll();
          location.hash = '#/today';
        }
      });
      root.querySelector('[data-act=install]')?.addEventListener('click', async () => {
        const ev = window.lunaraInstall; if (!ev) return;
        ev.prompt(); await ev.userChoice; window.lunaraInstall = null; rerender();
      });
    },
  };
}
