import { getState, getLog, setPeriodDay, setPeriodDays } from '../store.js';
import { computeStats, predict, buildDayMap } from '../cycle.js';
import { todayKey, toKey, addDays, diffDays, fmtLong, monthName, WEEKDAYS, plural } from '../dates.js';
import { FLOW, SYMPTOMS, MOODS, label } from '../catalog.js';
import { esc, toast } from '../ui.js';
import { icon } from '../icons.js';

let cursor = null; // { y, m }
let selected = null;

const TYPE_TEXT = {
  period: 'Día de periodo', predicted: 'Periodo previsto', fertile: 'Ventana fértil', ovulation: 'Ovulación estimada',
};

function dayCard(s, d, map, pred) {
  const log = getLog(d);
  const type = map.get(d);
  const lines = [];
  if (pred && d >= pred.last.start) lines.push(`Ciclo día ${diffDays(pred.last.start, d) % pred.avgCycle + 1}`);
  if (type) lines.push(TYPE_TEXT[type]);
  const tags = [];
  if (log.flow) tags.push(['droplet', label(FLOW, log.flow)]);
  (log.symptoms || []).forEach((id) => tags.push([SYMPTOMS.find((x) => x.id === id)?.icon || 'circle', label(SYMPTOMS, id)]));
  (log.moods || []).forEach((id) => tags.push([MOODS.find((x) => x.id === id)?.icon || 'circle', label(MOODS, id)]));
  if (log.temp) tags.push(['thermometer', `${log.temp} °C`]);
  if (log.notes) tags.push(['notebook-pen', log.notes.slice(0, 40)]);
  const future = d > todayKey();
  return `
  <section class="card">
    <div class="card-head"><h2>${fmtLong(d)}</h2></div>
    ${lines.length ? `<p class="muted">${lines.join(' · ')}</p>` : ''}
    ${tags.length ? `<div class="tags">${tags.map(([ic, x]) => `<span class="tag">${icon(ic)} ${esc(x)}</span>`).join('')}</div>` : ''}
    ${future ? '' : `<a class="btn primary block" href="#/log/${d}">${tags.length ? 'Editar registro' : 'Registrar este día'}</a>`}
  </section>`;
}

export function render(params = []) {
  const s = getState();
  const t = todayKey();
  const edit = params[0] === 'edit';
  if (!cursor) { const n = new Date(); cursor = { y: n.getFullYear(), m: n.getMonth() }; }
  if (!selected) selected = t;
  const stats = computeStats(s);
  const pred = s.profile.goal === 'pregnant' ? null : predict(s, t, stats);
  const map = s.profile.goal === 'pregnant' ? new Map(s.periodDays.map((d) => [d, 'period'])) : buildDayMap(s, stats, pred, t);

  const first = new Date(cursor.y, cursor.m, 1, 12);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cal-cell empty"></span>';
  for (let n = 1; n <= days; n++) {
    const d = toKey(new Date(cursor.y, cursor.m, n, 12));
    const type = map.get(d) || '';
    const logged = Object.keys(getLog(d)).length > 0;
    const isPeriod = s.periodDays.includes(d);
    const cls = ['cal-cell', type && `day-${type}`, d === t && 'is-today', d === selected && !edit && 'is-selected', d > t && 'future'].filter(Boolean).join(' ');
    cells += `<button type="button" class="${cls}" data-day="${d}" ${edit && d > t ? 'disabled' : ''}>
      <span class="num">${n}</span>
      ${edit ? `<span class="check ${isPeriod ? 'on' : ''}">${isPeriod ? icon('check') : ''}</span>` : `<span class="dot ${logged ? 'on' : ''}"></span>`}
    </button>`;
  }

  let summary = '';
  if (pred && !edit) {
    summary = `<p class="cal-summary">${pred.inPeriod ? `Periodo: día ${pred.periodDay}`
      : pred.late ? `Retraso de ${plural(pred.late, 'día', 'días')}`
        : `Próximo periodo en ${plural(pred.daysUntil, 'día', 'días')}`}</p>`;
  }

  return {
    html: `
    <header class="topbar">
      <div><p class="eyebrow">${edit ? 'Toca los días de tu periodo' : 'Calendario'}</p><h1 class="cap">${monthName(cursor.y, cursor.m)}</h1></div>
      <div class="row">
        <button class="icon-btn" data-nav="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
        <button class="icon-btn" data-nav="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
      </div>
    </header>
    ${summary}
    <section class="card cal ${edit ? 'editing' : ''}">
      <div class="cal-grid cal-head">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i class="lg lg-period"></i>Periodo</span>
        <span><i class="lg lg-predicted"></i>Previsto</span>
        <span><i class="lg lg-fertile"></i>Fértil</span>
        <span><i class="lg lg-ovulation"></i>Ovulación</span>
      </div>
    </section>
    <div class="center-actions">
      ${edit
        ? `<a class="btn primary" href="#/calendar">Listo</a>`
        : `<a class="btn secondary" href="#/calendar/edit">${icon('pencil')} Editar fechas del periodo</a>
           <button class="btn ghost" data-act="today">Hoy</button>`}
    </div>
    ${edit ? `<p class="muted center small">Al marcar el primer día de un periodo se completan automáticamente ${stats.avgPeriod} días (hasta hoy). Toca un día marcado para quitarlo.</p>` : dayCard(s, selected, map, pred)}
    `,
    bind(root) {
      root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
        const d = new Date(cursor.y, cursor.m + Number(b.dataset.nav), 1);
        cursor = { y: d.getFullYear(), m: d.getMonth() };
        window.dispatchEvent(new Event('rerender'));
      }));
      root.querySelector('[data-act=today]')?.addEventListener('click', () => {
        const n = new Date(); cursor = { y: n.getFullYear(), m: n.getMonth() }; selected = t;
        window.dispatchEvent(new Event('rerender'));
      });
      root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
        const d = b.dataset.day;
        if (!edit) { selected = d; window.dispatchEvent(new Event('rerender')); return; }
        if (d > t) return;
        const has = new Set(s.periodDays);
        if (has.has(d)) { setPeriodDay(d, false); return; }
        const nearby = [-2, -1, 1, 2].some((k) => has.has(addDays(d, k)));
        if (nearby) { setPeriodDay(d, true); return; }
        const keys = [];
        for (let i = 0; i < stats.avgPeriod; i++) { const k = addDays(d, i); if (k <= t) keys.push(k); }
        setPeriodDays(keys, true);
        toast(`Periodo marcado: ${plural(keys.length, 'día', 'días')}`);
      }));
    },
  };
}
