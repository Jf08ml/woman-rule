import { getState, update, replaceState, resetAll } from '../store.js';
import { todayKey, isValidKey, fmt, addDays } from '../dates.js';
import { REMINDER_INFO } from '../reminders.js';
import {
  enableNotifications, disableNotifications, syncReminders, testLocal, testServer,
  permission, pushStatus, isIOS, isStandalone, notificationsSupported,
} from '../push.js';
import { esc, toast, modal, confirmDialog, sha256, chips } from '../ui.js';
import {
  CONTRACEPTION, PACK_TYPES, REGULARITY, SITUATIONS, CONDITIONS, methodOf, methodMode,
  fertilityTracked, methodHasReminder, takesPill, contraceptionPlan, bmi,
} from '../health.js';
import { icon, badge } from '../icons.js';
import { APP_VERSION } from './feedback.js';

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

function relevantReminders(s) {
  const p = s.profile;
  if (p.goal === 'pregnant') return REMINDER_INFO.filter((i) => ['pregnancyWeekly', 'logDaily', 'water'].includes(i.key));
  const hide = new Set(['pregnancyWeekly']);
  if (!fertilityTracked(p)) { hide.add('fertile'); hide.add('ovulation'); }
  if (methodMode(p) !== 'natural') hide.add('periodLate');
  if (p.contraception && !methodHasReminder(p.contraception) && !takesPill(p, s.reminders)) hide.add('pill');
  return REMINDER_INFO.filter((i) => !hide.has(i.key));
}

const dateLong = (k) => fmt(k, { day: 'numeric', month: 'long', year: 'numeric' });

function methodDetails(s) {
  const p = s.profile;
  const m = methodOf(p);
  if (!m) return '';
  const t = todayKey();
  const plan = contraceptionPlan(s, t);
  const date = (lbl, min) => `<label class="field">${lbl}<input type="date" data-h="methodDate" max="${t}" min="${min}" value="${p.methodDate || ''}"></label>`;
  if (m.id === 'pill') {
    const type = p.packType || '21-7';
    return `<label class="field">Tipo de blíster<select data-h="packType">${PACK_TYPES.map((o) => `<option value="${o.id}" ${type === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
      ${type === 'continuous' ? '' : date('Primera píldora del blíster actual (o de cualquier blíster anterior)', addDays(t, -400))}
      ${plan?.day && !plan.continuous ? `<p class="muted small">Hoy es el día ${plan.day} de tu blíster${plan.inBreak ? ' (descanso)' : ''}.</p>` : ''}`;
  }
  if (m.id === 'patch' || m.id === 'ring') {
    return `<label class="field">Uso<select data-h="packType"><option value="21-7" ${p.packType !== 'continuous' ? 'selected' : ''}>3 semanas + 1 de descanso</option><option value="continuous" ${p.packType === 'continuous' ? 'selected' : ''}>Continuo, sin descanso</option></select></label>
      ${date(`Día en que pusiste el primer ${m.id === 'patch' ? 'parche' : 'anillo'} del ciclo`, addDays(t, -400))}`;
  }
  if (m.id === 'injection') {
    return `<div class="grid2"><label class="field">Frecuencia<select data-h="injectionInterval"><option value="30" ${Number(p.injectionInterval) === 30 ? 'selected' : ''}>Mensual</option><option value="90" ${Number(p.injectionInterval) !== 30 ? 'selected' : ''}>Cada 3 meses</option></select></label>
      ${date('Última inyección', addDays(t, -200))}</div>
      ${plan?.next ? `<p class="muted small">Próxima inyección: <b>${dateLong(plan.next)}</b>.</p>` : ''}`;
  }
  if (m.years) {
    return `${date('Fecha de colocación', addDays(t, -365 * 12))}
      ${plan?.expiry ? `<p class="muted small">Duración habitual: ${m.years} años · revisión o cambio hacia el <b>${dateLong(plan.expiry)}</b>. Confírmalo según tu modelo.</p>` : ''}`;
  }
  return '';
}

function healthCard(s) {
  const p = s.profile;
  const pregnant = p.goal === 'pregnant';
  const b = bmi(s);
  const year = Number(todayKey().slice(0, 4));
  const sexVal = p.sexActive === true ? 'yes' : p.sexActive === false ? 'no' : 'skip';
  return `
    <section class="card" id="health">
      <h2 class="h-ic">${icon('stethoscope')} Mi salud</h2>
      <p class="muted small">Opcional. Ajusta tus predicciones, avisos y consejos, y solo se guarda en este dispositivo.</p>
      ${pregnant ? '' : `
        <label class="field">Método anticonceptivo
          <select data-h="contraception"><option value="" ${p.contraception ? '' : 'selected'}>Sin indicar</option>
            ${CONTRACEPTION.map((o) => `<option value="${o.id}" ${p.contraception === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
        ${methodDetails(s)}
        ${methodMode(p) !== 'natural' ? '<p class="status">Con tu método no calculamos ventana fértil ni ovulación.</p>' : ''}`}
      ${p.goal === 'track' ? `
        <p class="field-label">¿Tienes relaciones sexuales?</p>
        <div class="seg-ctl">${[['yes', 'Sí'], ['no', 'No'], ['skip', 'Prefiero no decir']].map(([v, l]) => `<button type="button" data-sex="${v}" class="${sexVal === v ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="grid2">
        <label class="field">Año de nacimiento<input type="number" inputmode="numeric" min="1940" max="${year - 8}" data-h="birthYear" value="${p.birthYear ?? ''}" placeholder="—"></label>
        <label class="field">Estatura<input type="number" inputmode="numeric" min="120" max="220" data-h="height" value="${p.height ?? ''}" placeholder="—"><small>cm</small></label>
        <label class="field">${pregnant ? 'Peso antes del embarazo' : 'Peso de referencia'}<input type="number" inputmode="decimal" step="0.1" min="30" max="250" data-h="weight" value="${p.weight ?? ''}" placeholder="—"><small>kg${pregnant ? '' : ' · el registro diario lo actualiza'}</small></label>
      </div>
      ${b ? `<p class="status ${b.tone === 'ok' ? 'ok' : b.tone === 'warn' ? 'warn' : ''}">IMC ${b.value} · ${b.cat}</p>` : ''}
      ${pregnant ? '' : `
        <div class="grid2">
          <label class="field">Mis ciclos son<select data-h="regularity"><option value="">Sin indicar</option>${REGULARITY.map((o) => `<option value="${o.id}" ${p.regularity === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
          <label class="field">Situación<select data-h="situation">${SITUATIONS.map((o) => `<option value="${o.id}" ${p.situation === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
        </div>`}
      <p class="field-label">Condiciones de salud</p>
      ${chips(CONDITIONS, p.conditions, 'conditions')}
      ${methodOf(p)?.combined ? `<label class="check-row"><input type="checkbox" data-h="smoker" ${p.smoker ? 'checked' : ''}> Fumo</label>` : ''}
    </section>`;
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

    <a class="card link-card" href="#/feedback">
      ${badge('sparkles')}
      <span><b>Mejoras</b><small>Sugiere funciones o cuéntanos qué falla</small></span>
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

    ${healthCard(s)}

    <section class="card" id="notifications">
      <div class="card-head"><h2 class="h-ic">${icon('bell')} Notificaciones</h2>
        <label class="switch"><input type="checkbox" data-act="notif" ${r.enabled ? 'checked' : ''}><span></span></label>
      </div>
      ${notifStatus(s)}
      ${r.enabled ? `
        <label class="field inline">Hora de los avisos del ciclo<input type="time" data-act="time" value="${r.time}"></label>
        <ul class="rems">${relevantReminders(s).map((i) => reminderRow(s, i)).join('')}</ul>
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
    <p class="disclaimer">Lunara · v${APP_VERSION} — Las predicciones son estimaciones basadas en tus datos y no sustituyen el consejo médico ni un método anticonceptivo.</p>
    `,
    bind(root) {
      if (['notifications', 'health'].includes(params[0]) && scrolledTo !== params[0]) {
        scrolledTo = params[0];
        setTimeout(() => root.querySelector(`#${params[0]}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => update((st) => {
        const g = b.dataset.goal;
        if (g === 'conceive' && st.profile.goal !== 'conceive') {
          st.profile.conceiveSince = todayKey();
          st.profile.sexActive = true;
          if (methodMode(st.profile) !== 'natural') toast('Si dejaste tu anticonceptivo, actualízalo en “Mi salud”', 4000);
        }
        if (g !== 'conceive') st.profile.conceiveSince = null;
        st.profile.goal = g;
      })));

      // Mi salud
      const t0 = todayKey();
      const year = Number(t0.slice(0, 4));
      const ranges = { birthYear: [1940, year - 8], height: [120, 220], weight: [30, 250] };
      root.querySelectorAll('[data-h]').forEach((el) => el.addEventListener('change', () => {
        const k = el.dataset.h;
        if (k === 'smoker') { update((st) => { st.profile.smoker = el.checked; }); return; }
        if (ranges[k]) {
          const [min, max] = ranges[k];
          const v = el.value === '' ? null : Number(el.value);
          if (v !== null && (!Number.isFinite(v) || v < min || v > max)) { toast(`Introduce un valor entre ${min} y ${max}`); el.value = p[k] ?? ''; return; }
          update((st) => { st.profile[k] = v === null ? null : k === 'weight' ? Math.round(v * 10) / 10 : Math.round(v); });
          return;
        }
        if (k === 'methodDate') {
          if (el.value && (!isValidKey(el.value) || el.value > t0)) { toast('La fecha no puede ser futura'); el.value = p.methodDate || ''; return; }
          update((st) => { st.profile.methodDate = el.value || null; });
          return;
        }
        update((st) => {
          const pr = st.profile;
          if (k === 'contraception') {
            pr.contraception = el.value || null;
            pr.methodDate = null;
            pr.packType = pr.contraception === 'pill' ? '21-7' : pr.packType === 'continuous' ? 'continuous' : '21-7';
            st.reminders.pill.on = methodHasReminder(pr.contraception);
            st.settings.healthAsked = true;
            if (st.reminders.pill.on && !st.reminders.enabled) toast('Activa las notificaciones para recibir los avisos de tu método', 4000);
          } else if (k === 'injectionInterval') pr.injectionInterval = Number(el.value);
          else pr[k] = el.value || null;
          if (k === 'situation' && !pr.situation) pr.situation = 'none';
        });
      }));
      root.querySelectorAll('[data-sex]').forEach((b) => b.addEventListener('click', () => update((st) => {
        st.profile.sexActive = { yes: true, no: false }[b.dataset.sex] ?? null;
      })));
      root.querySelectorAll('.chips[data-name=conditions] .chip').forEach((b) => b.addEventListener('click', () => update((st) => {
        const set = new Set(st.profile.conditions || []);
        if (set.has(b.dataset.id)) set.delete(b.dataset.id); else set.add(b.dataset.id);
        st.profile.conditions = [...set];
      })));
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
