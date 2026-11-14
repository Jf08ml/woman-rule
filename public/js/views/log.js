import { getState, getLog, setLog, setPeriodDay } from '../store.js';
import { todayKey, addDays, fmtLong, isValidKey } from '../dates.js';
import { FLOW, SYMPTOMS, MOODS, DISCHARGE, SEX, OV_TEST, PREG_TEST } from '../catalog.js';
import { esc, chips, toast } from '../ui.js';
import { icon } from '../icons.js';

export function render(params = []) {
  const s = getState();
  const t = todayKey();
  let d = isValidKey(params[0]) ? params[0] : t;
  if (d > t) d = t;
  const log = getLog(d);
  const isPeriod = s.periodDays.includes(d);
  const prev = addDays(d, -1);
  const next = addDays(d, 1);
  const showPill = s.reminders.pill.on || log.pill;

  return {
    html: `
    <header class="topbar sticky">
      <a class="icon-btn" href="#/log/${prev}" aria-label="Día anterior">${icon('chevron-left')}</a>
      <div class="center"><p class="eyebrow">${d === t ? 'Hoy' : 'Registro'}</p><h1 class="h-sm cap">${fmtLong(d)}</h1></div>
      ${next <= t ? `<a class="icon-btn" href="#/log/${next}" aria-label="Día siguiente">${icon('chevron-right')}</a>` : '<span class="icon-btn ghost"></span>'}
    </header>

    <section class="card">
      <div class="card-head"><h2 class="h-ic">${icon('droplet')} Periodo</h2>
        <label class="switch"><input type="checkbox" data-act="period" ${isPeriod ? 'checked' : ''}><span></span></label>
      </div>
      ${isPeriod ? `<p class="muted small">Intensidad del flujo</p>${chips(FLOW, log.flow, 'flow', false)}` : '<p class="muted small">Actívalo si hoy tienes el periodo.</p>'}
    </section>

    <section class="card"><h2>Síntomas</h2>${chips(SYMPTOMS, log.symptoms, 'symptoms')}</section>
    <section class="card"><h2>Estado de ánimo</h2>${chips(MOODS, log.moods, 'moods')}</section>
    <section class="card"><h2>Flujo vaginal</h2>${chips(DISCHARGE, log.discharge, 'discharge', false)}</section>
    <section class="card"><h2>Actividad sexual</h2>${chips(SEX, log.sex, 'sex', false)}</section>

    ${showPill || s.profile.goal === 'track' ? `
    <section class="card">
      <div class="card-head"><h2 class="h-ic">${icon('pill')} Píldora anticonceptiva</h2>
        <label class="switch"><input type="checkbox" data-act="pill" ${log.pill ? 'checked' : ''}><span></span></label>
      </div>
      <p class="muted small">Marca si tomaste tu píldora este día.</p>
    </section>` : ''}

    <section class="card">
      <h2>Pruebas</h2>
      <p class="muted small">Prueba de ovulación</p>${chips(OV_TEST, log.ovTest, 'ovTest', false)}
      <p class="muted small">Prueba de embarazo</p>${chips(PREG_TEST, log.pregTest, 'pregTest', false)}
    </section>

    <section class="card">
      <h2>Mediciones</h2>
      <div class="measure">
        <label><span class="h-ic">${icon('thermometer')} Temperatura basal <span class="unit">°C</span></span>
          <input type="number" inputmode="decimal" step="0.01" min="34" max="42" data-field="temp" value="${log.temp ?? ''}" placeholder="36.50"></label>
        <label><span class="h-ic">${icon('weight')} Peso <span class="unit">kg</span></span>
          <input type="number" inputmode="decimal" step="0.1" min="20" max="300" data-field="weight" value="${log.weight ?? ''}" placeholder="—"></label>
        <label><span class="h-ic">${icon('bed')} Sueño <span class="unit">horas</span></span>
          <input type="number" inputmode="decimal" step="0.5" min="0" max="24" data-field="sleep" value="${log.sleep ?? ''}" placeholder="—"></label>
      </div>
      <div class="water">
        <span class="h-ic">${icon('glass-water')} Agua</span>
        <button class="icon-btn" data-water="-1" aria-label="Quitar vaso">${icon('minus')}</button>
        <b>${log.water || 0}</b><span class="muted small">/ 8 vasos</span>
        <button class="icon-btn" data-water="1" aria-label="Añadir vaso">${icon('plus')}</button>
      </div>
    </section>

    <section class="card">
      <h2 class="h-ic">${icon('notebook-pen')} Notas</h2>
      <textarea data-field="notes" rows="3" maxlength="1000" placeholder="Escribe lo que quieras recordar…">${esc(log.notes || '')}</textarea>
    </section>
    <div class="center-actions"><a class="btn primary" href="#/today">Listo</a></div>
    `,
    bind(root) {
      root.querySelector('[data-act=period]').addEventListener('change', (e) => {
        setPeriodDay(d, e.target.checked);
        if (!e.target.checked) setLog(d, { flow: null });
        toast(e.target.checked ? 'Día de periodo registrado' : 'Día de periodo eliminado');
      });
      root.querySelector('[data-act=pill]')?.addEventListener('change', (e) => setLog(d, { pill: e.target.checked }));
      root.querySelectorAll('.chips').forEach((group) => {
        const name = group.dataset.name;
        const multi = group.dataset.multi === 'true';
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.chip');
          if (!btn) return;
          const id = btn.dataset.id;
          const cur = getLog(d)[name];
          if (multi) {
            let set = new Set(cur || []);
            if (set.has(id)) set.delete(id);
            else if (id === 'fine') set = new Set(['fine']);
            else { set.delete('fine'); set.add(id); }
            setLog(d, { [name]: [...set] });
          } else {
            setLog(d, { [name]: cur === id ? null : id });
          }
        });
      });
      root.querySelectorAll('[data-field]').forEach((input) => input.addEventListener('change', () => {
        const f = input.dataset.field;
        if (f === 'notes') { setLog(d, { notes: input.value.trim() }); return; }
        const v = input.value === '' ? null : Number(input.value);
        if (v !== null && (Number.isNaN(v) || v < Number(input.min) || v > Number(input.max))) { toast('Valor fuera de rango'); return; }
        setLog(d, { [f]: v });
      }));
      root.querySelectorAll('[data-water]').forEach((b) => b.addEventListener('click', () => {
        const w = Math.max(0, Math.min(20, (getLog(d).water || 0) + Number(b.dataset.water)));
        setLog(d, { water: w || null });
      }));
    },
  };
}
