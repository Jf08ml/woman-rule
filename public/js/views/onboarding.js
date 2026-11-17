import { update } from '../store.js';
import { todayKey, addDays, isValidKey, diffDays, fmt } from '../dates.js';
import { computeStats } from '../cycle.js';
import { enableNotifications } from '../push.js';
import { esc, toast, chips } from '../ui.js';
import { icon } from '../icons.js';
import { CONTRACEPTION, PACK_TYPES, REGULARITY, SITUATIONS, CONDITIONS, option, methodHasReminder } from '../health.js';

let step = 0;
const draft = {
  name: '', goal: 'track', lastStart: '', unknown: false, pastStarts: [''], periodLength: 5, cycleLength: 28,
  regularity: null, contraception: null, packType: '21-7', methodDate: '', injectionInterval: 90,
  birthYear: '', sexActive: null, situation: 'none', height: '', weight: '', conditions: [], smoker: false,
};
const rerender = () => window.dispatchEvent(new Event('rerender'));
const num = (v, min, max) => { const n = Number(v); return v !== '' && v !== null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
const thisYear = Number(todayKey().slice(0, 4));

const MAX_PAST = 5;
const MIN_GAP = 18;

/** Inicios de periodo conocidos (anteriores + el último), ordenados y sin repetir. */
function knownStarts() {
  if (draft.unknown || !isValidKey(draft.lastStart)) return [];
  return [...new Set([...draft.pastStarts.filter((v) => isValidKey(v) && v < draft.lastStart), draft.lastStart])].sort();
}

/** Días de periodo a partir de los inicios: cada uno dura periodLength sin solaparse con el siguiente ni pasar de hoy. */
function periodDaysFrom(starts, t = todayKey()) {
  const days = [];
  starts.forEach((start, i) => {
    const next = starts[i + 1];
    for (let k = 0; k < draft.periodLength; k++) {
      const d = addDays(start, k);
      if (d > t || (next && d >= addDays(next, -1))) break;
      days.push(d);
    }
  });
  return days;
}

/** Estadísticas con el mismo motor que usará la app tras el registro. */
function historyStats() {
  const starts = knownStarts();
  if (starts.length < 2) return null;
  const stats = computeStats({ periodDays: periodDaysFrom(starts), profile: { cycleLength: draft.cycleLength, periodLength: draft.periodLength } });
  const valid = stats.cycles.filter((c) => c.length >= MIN_GAP && c.length <= 60);
  return valid.length ? { ...stats, valid } : null;
}

// Métodos que necesitan una fecha o tipo para calcular su calendario
const needsDetails = (id) => ['pill', 'patch', 'ring', 'injection', 'implant', 'iud-hormonal', 'iud-copper'].includes(id);

function finish(withNotifications) {
  const goal = draft.goal;
  const t = todayKey();
  update((s) => {
    const p = s.profile;
    p.name = draft.name.trim();
    p.goal = goal;
    p.periodLength = draft.periodLength;
    const hist = historyStats();
    p.cycleLength = hist ? hist.avgCycle : draft.cycleLength;
    p.regularity = goal === 'pregnant' ? null : draft.regularity;
    p.contraception = goal === 'track' ? draft.contraception : goal === 'conceive' ? 'none' : null;
    p.packType = draft.packType;
    p.methodDate = needsDetails(p.contraception) && isValidKey(draft.methodDate) && draft.methodDate <= t ? draft.methodDate : null;
    p.injectionInterval = draft.injectionInterval;
    p.sexActive = goal === 'conceive' ? true : goal === 'pregnant' ? null : ({ yes: true, no: false }[draft.sexActive] ?? null);
    p.birthYear = num(draft.birthYear, 1940, thisYear - 8);
    p.height = num(draft.height, 120, 220);
    p.weight = num(draft.weight, 30, 250);
    p.situation = goal === 'pregnant' ? 'none' : draft.situation;
    p.conditions = [...draft.conditions];
    p.smoker = !!draft.smoker;
    p.conceiveSince = goal === 'conceive' ? t : null;
    if (goal === 'pregnant' && isValidKey(draft.lastStart)) s.pregnancy.lmp = draft.lastStart;
    if (!draft.unknown && isValidKey(draft.lastStart) && goal !== 'pregnant') {
      const days = new Set(s.periodDays);
      periodDaysFrom(knownStarts(), t).forEach((d) => days.add(d));
      s.periodDays = [...days].sort();
    }
    s.reminders.pill.on = methodHasReminder(p.contraception);
    if (withNotifications) s.reminders.enabled = true;
    s.settings.healthAsked = true;
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

const optionList = (key, list, compact = false) => `
  <div class="options ${compact ? 'compact' : ''}">
    ${list.map((o) => `<button type="button" class="option ${draft[key] === o.id ? 'on' : ''}" data-pick="${key}" data-v="${o.id}">
      <span class="ib ib-primary">${icon(o.icon)}</span><div><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</div></button>`).join('')}
  </div>`;

const seg = (key, list) => `
  <div class="seg-ctl">${list.map(([v, l]) => `<button type="button" data-pick="${key}" data-v="${v}" class="${String(draft[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;

function historyStep() {
  const hist = historyStats();
  const minDate = addDays(draft.lastStart, -400);
  const maxDate = addDays(draft.lastStart, -MIN_GAP);
  const rows = draft.pastStarts.map((v, i) => `
    <div class="past-row">
      <input type="date" class="date-big" data-past="${i}" min="${minDate}" max="${maxDate}" value="${v}" aria-label="Inicio de un periodo anterior">
      ${draft.pastStarts.length > 1 || v ? `<button type="button" class="icon-btn" data-rm="${i}" aria-label="Quitar fecha">${icon('minus')}</button>` : ''}
    </div>`).join('');
  const long = hist && hist.cycles.some((c) => c.length > 60);
  return `
    <div class="hero-ic">${icon('calendar-days')}</div>
    <h1>¿Recuerdas tus periodos anteriores?</h1>
    <p class="muted">Tu último periodo empezó el <b>${fmt(draft.lastStart, { day: 'numeric', month: 'long' })}</b>. Si sabes cuándo empezaron los anteriores (puedes mirarlo en otra app o en tu agenda), añade hasta ${MAX_PAST}. Con ellos calculamos tu ciclo real desde el primer día.</p>
    <div class="past-list">${rows}</div>
    ${draft.pastStarts.length < MAX_PAST ? `<button type="button" class="btn ghost block" data-act="add-past">${icon('plus')} Añadir otra fecha</button>` : ''}
    ${hist ? `
      <div class="card past-summary">
        <p>Tus ciclos: <b>${hist.valid.map((c) => c.length).join(' · ')}</b> días</p>
        <p>Tu ciclo medio: <b>${hist.avgCycle} días</b>${hist.valid.length < 3 ? '<br><small class="muted">Con 3 o más fechas la predicción es más precisa.</small>' : ''}</p>
        ${long ? '<p class="small muted">Hay un intervalo de más de 60 días: no lo usamos en la media. ¿Falta algún periodo entre medias?</p>' : ''}
      </div>` : ''}
    <p class="muted small">Es opcional: si no lo recuerdas, Lunara aprenderá tu ciclo con tus próximos registros.</p>`;
}

function detailsStep() {
  const t = todayKey();
  const id = draft.contraception;
  const m = option(CONTRACEPTION, id);
  const date = (lbl, min) => `<label class="field">${lbl}<input type="date" class="date-big" data-f="methodDate" max="${t}" min="${min}" value="${draft.methodDate}"></label>`;
  let body = '';
  if (id === 'pill') {
    body = `<p class="field-label">¿Cómo es tu blíster?</p>
      <div class="options compact">${PACK_TYPES.map((o) => `<button type="button" class="option ${draft.packType === o.id ? 'on' : ''}" data-pick="packType" data-v="${o.id}"><div><b>${o.label}</b></div></button>`).join('')}</div>
      ${draft.packType === 'continuous' ? '' : date('¿Qué día tomaste la primera píldora del blíster actual?', addDays(t, -60))}`;
  } else if (id === 'patch' || id === 'ring') {
    const w = id === 'patch' ? 'parche' : 'anillo';
    body = `<p class="field-label">¿Cómo lo usas?</p>
      ${seg('packType', [['21-7', '3 semanas + 1 de descanso'], ['continuous', 'Continuo, sin descanso']])}
      ${date(`¿Qué día pusiste el primer ${w} de este ciclo?`, addDays(t, -60))}`;
  } else if (id === 'injection') {
    body = `<p class="field-label">¿Cada cuánto te la pones?</p>
      ${seg('injectionInterval', [[30, 'Mensual'], [90, 'Cada 3 meses']])}
      ${date('¿Cuándo fue tu última inyección?', addDays(t, -120))}`;
  } else {
    body = `${date(`¿Cuándo te colocaron el ${m.label.startsWith('DIU') ? m.label : m.label.toLowerCase()}?`, addDays(t, -365 * 12))}
      <p class="muted small">Te avisaremos cuando se acerque la fecha de cambio. La duración exacta depende del modelo: confírmala con tu médico.</p>`;
  }
  return `
    <div class="hero-ic">${icon(m.icon)}</div>
    <h1>${esc(m.label)}</h1>
    <p class="muted">Con estos datos calculamos tu calendario y te recordamos cada toma o cambio.</p>
    ${body}
    <p class="muted small">Si no lo recuerdas, déjalo en blanco y añádelo después en Perfil.</p>`;
}

export function render() {
  const t = todayKey();
  const pregnant = draft.goal === 'pregnant';
  const track = draft.goal === 'track';
  const combined = option(CONTRACEPTION, draft.contraception)?.combined;
  const steps = {
    welcome: () => `
      <img class="hero-logo" src="/icons/logo.svg" alt="" width="96" height="96">
      <h1>Bienvenida a Lunara</h1>
      <p class="muted">Conoce tu ciclo, anticipa tu periodo y tu ventana fértil, registra cómo te sientes y recibe recordatorios. Tus datos se quedan en tu dispositivo.</p>
      <label class="field">¿Cómo te llamamos? (opcional)<input type="text" maxlength="30" data-f="name" value="${esc(draft.name)}" placeholder="Tu nombre"></label>`,
    goal: () => `
      <h1>¿Cuál es tu objetivo?</h1>
      <div class="options">
        ${[['track', 'droplet', 'Seguir mi ciclo', 'Predicciones del periodo y síntomas'],
          ['conceive', 'flower-2', 'Quedar embarazada', 'Ventana fértil y ovulación'],
          ['pregnant', 'baby', 'Estoy embarazada', 'Seguimiento semana a semana']]
          .map(([v, ic, l, d]) => `<button type="button" class="option ${draft.goal === v ? 'on' : ''}" data-pick="goal" data-v="${v}"><span class="ib ib-primary">${icon(ic)}</span><div><b>${l}</b><small>${d}</small></div></button>`).join('')}
      </div>`,
    last: () => `
      <h1>${pregnant ? '¿Cuándo empezó tu última regla?' : '¿Cuándo empezó tu último periodo?'}</h1>
      <p class="muted">${pregnant ? 'La usamos para calcular tus semanas de embarazo y la fecha probable de parto.' : 'Elige el primer día de sangrado.'}</p>
      <input type="date" class="date-big" data-f="lastStart" max="${t}" min="${addDays(t, pregnant ? -300 : -120)}" value="${draft.lastStart}">
      ${pregnant ? '' : `<label class="check-row"><input type="checkbox" data-f="unknown" ${draft.unknown ? 'checked' : ''}> No lo recuerdo</label>`}`,
    history: historyStep,
    period: () => `
      <h1>¿Cuántos días suele durar tu periodo?</h1>
      <p class="muted">Normalmente entre 3 y 7 días.</p>
      ${stepper('periodLength', 1, 12, 'días')}`,
    cycle: () => `
      <h1>¿Cuánto dura tu ciclo?</h1>
      <p class="muted">Desde el primer día de un periodo hasta el primer día del siguiente. La media es de 28 días.</p>
      ${stepper('cycleLength', 18, 60, 'días')}`,
    regularity: () => `
      <h1>¿Tus ciclos son regulares?</h1>
      <p class="muted">Si varían mucho, te mostraremos un rango de fechas en lugar de un solo día.</p>
      ${optionList('regularity', REGULARITY)}`,
    method: () => `
      <h1>¿Usas algún método anticonceptivo?</h1>
      <p class="muted">Con un método hormonal no hay ovulación: no te mostraremos una ventana fértil que no existe y podemos recordarte tus tomas.</p>
      ${optionList('contraception', CONTRACEPTION, true)}`,
    details: detailsStep,
    about: () => `
      <div class="hero-ic">${icon('user-round')}</div>
      <h1>Un poco sobre ti</h1>
      <p class="muted">Todo es opcional. Nos ayuda a ajustar predicciones y consejos a tu edad y a tu momento de vida.</p>
      <label class="field">Año de nacimiento<input type="number" inputmode="numeric" min="1940" max="${thisYear - 8}" data-f="birthYear" value="${esc(draft.birthYear)}" placeholder="Ej. 1995"></label>
      ${track ? `
        <p class="field-label">¿Tienes relaciones sexuales?</p>
        ${seg('sexActive', [['yes', 'Sí'], ['no', 'No'], ['skip', 'Prefiero no decir']])}
        <p class="muted small">Si no, ocultamos la probabilidad de embarazo y los avisos no te hablarán de pruebas de embarazo.</p>` : ''}
      ${pregnant ? '' : `
        <label class="field">¿Estás en alguna de estas situaciones?
          <select data-f="situation">${SITUATIONS.map((o) => `<option value="${o.id}" ${draft.situation === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>`}`,
    health: () => `
      <div class="hero-ic">${icon('stethoscope')}</div>
      <h1>Tu salud</h1>
      <p class="muted">Opcional. Con tu estatura y peso calculamos tu IMC, que influye en la ovulación${pregnant ? ' y en cuánto peso conviene ganar en el embarazo' : ''}.</p>
      <div class="grid2">
        <label class="field">Estatura<input type="number" inputmode="numeric" min="120" max="220" data-f="height" value="${esc(draft.height)}" placeholder="cm"><small>cm</small></label>
        <label class="field">${pregnant ? 'Peso antes del embarazo' : 'Peso'}<input type="number" inputmode="decimal" step="0.1" min="30" max="250" data-f="weight" value="${esc(draft.weight)}" placeholder="kg"><small>kg</small></label>
      </div>
      <p class="field-label">¿Tienes alguna de estas condiciones?</p>
      ${chips(CONDITIONS, draft.conditions, 'conditions')}
      ${combined ? `<label class="check-row"><input type="checkbox" data-f="smoker" ${draft.smoker ? 'checked' : ''}> Fumo</label>` : ''}`,
    notif: () => `
      <div class="hero-ic">${icon('bell-ring')}</div>
      <h1>Recordatorios</h1>
      <p class="muted">Activa las notificaciones para saber cuándo llega tu periodo${track && draft.contraception && draft.contraception !== 'none' ? ', cuándo toca tu anticonceptivo' : ', tu ventana fértil'} y más. Podrás personalizarlas en Perfil.</p>`,
  };

  const order = ['welcome', 'goal', 'last'];
  if (!pregnant && !draft.unknown && isValidKey(draft.lastStart)) order.push('history');
  if (!pregnant) order.push('period');
  // Si las fechas ya dan al menos un ciclo real, no preguntamos la duración del ciclo
  if (!pregnant && !historyStats()) order.push('cycle');
  if (!pregnant) order.push('regularity');
  if (track) order.push('method');
  if (track && needsDetails(draft.contraception)) order.push('details');
  order.push('about', 'health', 'notif');
  const idx = Math.min(step, order.length - 1);
  const current = order[idx];
  const last = idx === order.length - 1;
  const optional = ['history', 'about', 'health'].includes(current);

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
        ${optional ? '<button class="btn ghost block" data-act="omit">Omitir</button>' : ''}
        ${idx > 0 ? '<button class="btn ghost block" data-act="back">Atrás</button>' : ''}
      </div>
    </div>`,
    bind(root) {
      const read = () => {
        root.querySelectorAll('[data-f]').forEach((el) => { draft[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
        root.querySelectorAll('[data-past]').forEach((el) => { draft.pastStarts[Number(el.dataset.past)] = el.value; });
      };
      root.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', read));
      root.querySelectorAll('[data-past]').forEach((el) => el.addEventListener('change', () => {
        draft.pastStarts[Number(el.dataset.past)] = el.value;
        rerender();
      }));
      root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
        draft.pastStarts.splice(Number(b.dataset.rm), 1);
        if (!draft.pastStarts.length) draft.pastStarts.push('');
        rerender();
      }));
      root.querySelector('[data-act=add-past]')?.addEventListener('click', () => {
        if (draft.pastStarts.length < MAX_PAST) draft.pastStarts.push('');
        rerender();
      });
      root.querySelector('[data-f=name]')?.addEventListener('input', (e) => { draft.name = e.target.value; });
      root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
        read();
        const k = b.dataset.pick;
        let v = b.dataset.v;
        if (k === 'injectionInterval') v = Number(v);
        if (k === 'contraception' && v !== draft.contraception) {
          draft.methodDate = '';
          draft.packType = v === 'pill' ? '21-7' : draft.packType === 'continuous' ? 'continuous' : '21-7';
        }
        draft[k] = v;
        rerender();
      }));
      root.querySelectorAll('.chips[data-name=conditions] .chip').forEach((b) => b.addEventListener('click', () => {
        read();
        const set = new Set(draft.conditions);
        if (set.has(b.dataset.id)) set.delete(b.dataset.id); else set.add(b.dataset.id);
        draft.conditions = [...set];
        rerender();
      }));
      root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.step;
        const [min, max] = k === 'periodLength' ? [1, 12] : [18, 60];
        draft[k] = Math.min(max, Math.max(min, draft[k] + Number(b.dataset.d)));
        rerender();
      }));
      root.querySelector('[data-act=back]')?.addEventListener('click', () => { read(); step = idx - 1; rerender(); });
      root.querySelector('[data-act=omit]')?.addEventListener('click', () => {
        if (current === 'history') draft.pastStarts = [''];
        step = idx + 1; rerender();
      });
      root.querySelector('[data-act=next]')?.addEventListener('click', () => {
        read();
        if (current === 'last') {
          const v = draft.lastStart;
          if (!draft.unknown && !isValidKey(v)) { toast('Elige una fecha o marca “No lo recuerdo”'); return; }
          if (isValidKey(v) && v > t) { toast('La fecha no puede ser futura'); return; }
          if (pregnant && (!isValidKey(v) || diffDays(v, t) > 300)) { toast('Elige una fecha válida'); return; }
        }
        if (current === 'history') {
          const filled = draft.pastStarts.filter((v) => v);
          if (filled.some((v) => !isValidKey(v))) { toast('Revisa las fechas'); return; }
          if (filled.some((v) => v >= draft.lastStart)) { toast('Las fechas deben ser anteriores a tu último periodo'); return; }
          const starts = knownStarts();
          for (let i = 1; i < starts.length; i++) {
            if (diffDays(starts[i - 1], starts[i]) < MIN_GAP) {
              toast(`Entre el inicio de dos periodos debe haber al menos ${MIN_GAP} días: revisa el ${fmt(starts[i - 1])} y el ${fmt(starts[i])}`, 5000);
              return;
            }
          }
          draft.pastStarts = filled.length ? [...new Set(filled)].sort().reverse() : [''];
          // Con 2 o más ciclos sugerimos la regularidad según sus fechas
          const hist = historyStats();
          if (hist && hist.valid.length >= 2 && !draft.regularity) draft.regularity = hist.regular ? 'regular' : 'irregular';
        }
        if (current === 'regularity' && !draft.regularity) draft.regularity = 'unknown';
        if (current === 'method' && !draft.contraception) { toast('Elige una opción (puede ser “Ninguno”)'); return; }
        if (current === 'details' && draft.methodDate && (!isValidKey(draft.methodDate) || draft.methodDate > t)) { toast('La fecha no puede ser futura'); return; }
        if (current === 'about' && draft.birthYear !== '' && num(draft.birthYear, 1940, thisYear - 8) === null) { toast('Revisa el año de nacimiento'); return; }
        if (current === 'health') {
          if (draft.height !== '' && num(draft.height, 120, 220) === null) { toast('La estatura debe estar entre 120 y 220 cm'); return; }
          if (draft.weight !== '' && num(draft.weight, 30, 250) === null) { toast('El peso debe estar entre 30 y 250 kg'); return; }
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
