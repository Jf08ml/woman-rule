import { update } from '../store.js';
import { todayKey, addDays, isValidKey, diffDays } from '../dates.js';
import { enableNotifications } from '../push.js';
import { esc, toast } from '../ui.js';
import { icon } from '../icons.js';

let step = 0;
const draft = { name: '', goal: 'track', lastStart: '', unknown: false, periodLength: 5, cycleLength: 28 };
const rerender = () => window.dispatchEvent(new Event('rerender'));

function finish(withNotifications) {
  update((s) => {
    s.profile.name = draft.name.trim();
    s.profile.goal = draft.goal;
    s.profile.periodLength = draft.periodLength;
    s.profile.cycleLength = draft.cycleLength;
    if (draft.goal === 'pregnant' && isValidKey(draft.lastStart)) s.pregnancy.lmp = draft.lastStart;
    if (!draft.unknown && isValidKey(draft.lastStart) && draft.goal !== 'pregnant') {
      const days = new Set(s.periodDays);
      const t = todayKey();
      for (let i = 0; i < draft.periodLength; i++) { const d = addDays(draft.lastStart, i); if (d <= t) days.add(d); }
      s.periodDays = [...days].sort();
    }
    if (withNotifications) s.reminders.enabled = true;
    s.onboarded = true;
  });
  location.hash = '#/today';
}

const stepper = (key, min, max, unit) => `
  <div class="stepper">
    <button type="button" class="icon-btn big" data-step="${key}" data-d="-1">−</button>
    <div><strong>${draft[key]}</strong><small>${unit}</small></div>
    <button type="button" class="icon-btn big" data-step="${key}" data-d="1" data-min="${min}" data-max="${max}">+</button>
  </div>`;

export function render() {
  const t = todayKey();
  const pregnant = draft.goal === 'pregnant';
  const steps = [
    () => `
      <img class="hero-logo" src="/icons/logo.svg" alt="" width="96" height="96">
      <h1>Bienvenida a Lunara</h1>
      <p class="muted">Conoce tu ciclo, anticipa tu periodo y tu ventana fértil, registra cómo te sientes y recibe recordatorios. Tus datos se quedan en tu dispositivo.</p>
      <label class="field">¿Cómo te llamamos? (opcional)<input type="text" maxlength="30" data-f="name" value="${esc(draft.name)}" placeholder="Tu nombre"></label>`,
    () => `
      <h1>¿Cuál es tu objetivo?</h1>
      <div class="options">
        ${[['track', 'droplet', 'Seguir mi ciclo', 'Predicciones del periodo y síntomas'],
          ['conceive', 'flower-2', 'Quedar embarazada', 'Ventana fértil y ovulación'],
          ['pregnant', 'baby', 'Estoy embarazada', 'Seguimiento semana a semana']]
          .map(([v, ic, l, d]) => `<button type="button" class="option ${draft.goal === v ? 'on' : ''}" data-goal="${v}"><span class="ib ib-primary">${icon(ic)}</span><div><b>${l}</b><small>${d}</small></div></button>`).join('')}
      </div>`,
    () => `
      <h1>${pregnant ? '¿Cuándo empezó tu última regla?' : '¿Cuándo empezó tu último periodo?'}</h1>
      <p class="muted">${pregnant ? 'La usamos para calcular tus semanas de embarazo y la fecha probable de parto.' : 'Elige el primer día de sangrado.'}</p>
      <input type="date" class="date-big" data-f="lastStart" max="${t}" min="${addDays(t, pregnant ? -300 : -120)}" value="${draft.lastStart}">
      ${pregnant ? '' : `<label class="check-row"><input type="checkbox" data-f="unknown" ${draft.unknown ? 'checked' : ''}> No lo recuerdo</label>`}`,
    () => `
      <h1>¿Cuántos días suele durar tu periodo?</h1>
      <p class="muted">Normalmente entre 3 y 7 días.</p>
      ${stepper('periodLength', 1, 12, 'días')}`,
    () => `
      <h1>¿Cuánto dura tu ciclo?</h1>
      <p class="muted">Desde el primer día de un periodo hasta el primer día del siguiente. La media es de 28 días.</p>
      ${stepper('cycleLength', 18, 60, 'días')}`,
    () => `
      <div class="hero-ic">${icon('bell-ring')}</div>
      <h1>Recordatorios</h1>
      <p class="muted">Activa las notificaciones para saber cuándo llega tu periodo, tu ventana fértil, tomar la píldora y más. Podrás personalizarlas en Perfil.</p>`,
  ];
  // En embarazo omitimos duración de periodo/ciclo
  const order = pregnant ? [0, 1, 2, 5] : [0, 1, 2, 3, 4, 5];
  const idx = Math.min(step, order.length - 1);
  const current = order[idx];
  const last = idx === order.length - 1;

  return {
    html: `
    <div class="onboarding">
      <div class="dots">${order.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ob-body">${steps[current]()}</div>
      <div class="ob-actions">
        ${last
          ? `<button class="btn primary block" data-act="notif">Activar notificaciones</button>
             <button class="btn ghost block" data-act="skip">Ahora no</button>`
          : `<button class="btn primary block" data-act="next">Continuar</button>`}
        ${idx > 0 ? '<button class="btn ghost block" data-act="back">Atrás</button>' : ''}
      </div>
    </div>`,
    bind(root) {
      root.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', () => {
        draft[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      }));
      root.querySelector('[data-f=name]')?.addEventListener('input', (e) => { draft.name = e.target.value; });
      root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => { draft.goal = b.dataset.goal; rerender(); }));
      root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.step;
        const [min, max] = k === 'periodLength' ? [1, 12] : [18, 60];
        draft[k] = Math.min(max, Math.max(min, draft[k] + Number(b.dataset.d)));
        rerender();
      }));
      root.querySelector('[data-act=back]')?.addEventListener('click', () => { step = idx - 1; rerender(); });
      root.querySelector('[data-act=next]')?.addEventListener('click', () => {
        if (current === 2) {
          const v = root.querySelector('[data-f=lastStart]').value;
          draft.lastStart = v;
          if (!draft.unknown && !isValidKey(v)) { toast('Elige una fecha o marca “No lo recuerdo”'); return; }
          if (isValidKey(v) && v > t) { toast('La fecha no puede ser futura'); return; }
          if (pregnant && (!isValidKey(v) || diffDays(v, t) > 300)) { toast('Elige una fecha válida'); return; }
        }
        step = idx + 1; rerender();
      });
      root.querySelector('[data-act=skip]')?.addEventListener('click', () => finish(false));
      root.querySelector('[data-act=notif]')?.addEventListener('click', async () => {
        try {
          await enableNotifications();
          finish(true);
          toast('¡Listo! Notificaciones activadas');
        } catch (err) {
          toast(err.message, 5000);
          finish(false);
        }
      });
    },
  };
}
