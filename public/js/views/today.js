import { getState, getLog, setPeriodDay } from '../store.js';
import { computeStats, predict, buildDayMap, pregnancyInfo } from '../cycle.js';
import { todayKey, addDays, fmt, fmtLong, fromKey, plural } from '../dates.js';
import { PHASES, SYMPTOMS, MOODS, FLOW, babyFor, label, option, madeLove } from '../catalog.js';
import { icon, badge } from '../icons.js';
import { esc, toast, modal } from '../ui.js';
import { isIOS, isStandalone } from '../push.js';
import { installHelp } from './install.js';

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

function cycleRing(pred, map, center) {
  const total = Math.max(pred.avgCycle, pred.cycleDay);
  const step = 360 / total;
  const gap = total > 40 ? 0.6 : 1.4;
  let segs = '';
  for (let i = 0; i < total; i++) {
    const d = addDays(pred.last.start, i);
    const t = map.get(d) || 'none';
    segs += `<path class="seg seg-${t}" d="${arc(150, 150, 124, i * step + gap / 2, (i + 1) * step - gap / 2)}"/>`;
  }
  const [mx, my] = polar(150, 150, 124, (Math.min(pred.cycleDay, total) - 0.5) * step);
  return `
  <div class="ring-wrap">
    <svg viewBox="0 0 300 300" class="ring" aria-hidden="true">
      ${segs}
      <circle class="ring-marker" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="11"/>
    </svg>
    <div class="ring-center">${center}</div>
  </div>`;
}

function weekStrip(map) {
  const t = todayKey();
  let html = '<div class="week-strip">';
  for (let i = -3; i <= 3; i++) {
    const d = addDays(t, i);
    const type = map.get(d) || '';
    const logged = Object.keys(getLog(d)).length > 0;
    html += `<a href="#/log/${d}" class="wd ${d === t ? 'is-today' : ''}">
      <span class="wd-name">${fromKey(d).toLocaleDateString('es', { weekday: 'narrow' })}</span>
      <span class="wd-num day-${type}">${fromKey(d).getDate()}</span>
      <span class="wd-dot ${logged ? 'on' : ''}"></span></a>`;
  }
  return html + '</div>';
}

function todayLogCard() {
  const t = todayKey();
  const log = getLog(t);
  const items = [];
  if (log.flow) items.push(['droplet', label(FLOW, log.flow)]);
  (log.symptoms || []).forEach((id) => { const o = option(SYMPTOMS, id); if (o) items.push([o.icon, o.label]); });
  (log.moods || []).forEach((id) => { const o = option(MOODS, id); if (o) items.push([o.icon, o.label]); });
  if (log.temp) items.push(['thermometer', `${log.temp} °C`]);
  if (log.water) items.push(['glass-water', `${log.water} vasos`]);
  if (log.pill) items.push(['pill', 'Píldora tomada']);
  if (madeLove(log)) items.push(['heart', 'Hicimos el amor']);
  return `
  <section class="card">
    <div class="card-head"><h2>Mi día</h2><a class="link" href="#/log/${t}">${items.length ? 'Editar' : ''}</a></div>
    ${items.length ? `<div class="tags">${items.map(([ic, x]) => `<span class="tag">${icon(ic)} ${esc(x)}</span>`).join('')}</div>`
      : `<p class="muted">Aún no has registrado nada hoy. ¿Cómo te sientes?</p>`}
    <a class="btn primary block" href="#/log/${t}">${icon('plus')} Registrar síntomas</a>
  </section>`;
}

function notifCard(s) {
  if (s.reminders.enabled) return '';
  return `
  <section class="card accent">
    <div class="card-icon">${badge('bell-ring')}</div>
    <h2>Activa tus recordatorios</h2>
    <p class="muted">Te avisaremos antes de tu periodo, en tu ventana fértil, para tu píldora y más.</p>
    <a class="btn primary" href="#/settings/notifications">Activar notificaciones</a>
  </section>`;
}

function installCard() {
  if (isStandalone()) return '';
  if (window.lunaraInstall) {
    return `<section class="card"><h2 class="h-ic">${icon('smartphone')} Instala Lunara</h2><p class="muted">Úsala como una app, sin conexión y con notificaciones.</p>
      <button class="btn secondary" data-act="install">Instalar app</button></section>`;
  }
  return `<section class="card"><h2 class="h-ic">${icon('smartphone')} Instala Lunara</h2>
    <p class="muted">Acceso directo desde tu ${isIOS() ? 'pantalla de inicio. En iPhone es necesario para recibir notificaciones' : 'pantalla de inicio, sin conexión y con notificaciones'}.</p>
    <button class="btn secondary" data-act="install-help">Cómo instalar</button></section>`;
}

function phaseCard(pred) {
  const p = PHASES[pred.phase];
  return `
  <section class="card">
    <div class="card-head"><h2>${p.name}</h2><span class="pill phase-${pred.phase}">Ciclo día ${pred.cycleDay}</span></div>
    <p>${p.desc}</p>
    <ul class="tips">${p.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  </section>`;
}

function upcomingCard(pred) {
  const t = todayKey();
  const rows = [];
  const next = pred.upcoming[0];
  rows.push(['droplet', 'Próximo periodo', pred.late ? `Retraso de ${plural(pred.late, 'día', 'días')}` : fmtLong(next.periodStart)]);
  const fw = [pred.current, ...pred.upcoming].find((w) => w.fertileEnd >= t && !(pred.inPeriod && w === pred.current && w.fertileStart <= pred.last.end));
  if (fw) {
    rows.push(['flower-2', 'Ventana fértil', `${fmt(fw.fertileStart)} – ${fmt(fw.fertileEnd)}`]);
    rows.push(['sparkles', 'Ovulación', fw.ovulation === t ? 'Hoy' : fmtLong(fw.ovulation)]);
  }
  rows.push(['calendar-days', 'Siguiente', fmt(pred.upcoming[1].periodStart, { day: 'numeric', month: 'long' })]);
  return `
  <section class="card">
    <h2>Próximas fechas</h2>
    <ul class="list">${rows.map(([i, k, v]) => `<li>${badge(i, i === 'droplet' || i === 'calendar-days' ? 'primary' : 'fertile')}<span>${k}</span><b>${v}</b></li>`).join('')}</ul>
  </section>`;
}

function pregnancyView(s) {
  const p = pregnancyInfo(s);
  if (!p) return `<section class="card"><p>Indica la fecha de tu última regla en Perfil para seguir tu embarazo.</p><a class="btn primary" href="#/settings">Ir a Perfil</a></section>`;
  const size = babyFor(p.week);
  const deg = p.progress * 360;
  const [mx, my] = polar(150, 150, 124, Math.max(deg, 2));
  return `
  <div class="ring-wrap">
    <svg viewBox="0 0 300 300" class="ring" aria-hidden="true">
      <circle class="seg seg-none" cx="150" cy="150" r="124" fill="none"/>
      ${p.progress > 0 ? `<path class="seg seg-preg" d="${arc(150, 150, 124, 0, Math.min(deg, 359.9))}"/>` : ''}
      <circle class="ring-marker" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="11"/>
    </svg>
    <div class="ring-center">
      <small>Embarazo</small>
      <strong>Semana ${p.week}</strong>
      <span>+${plural(p.dayOfWeek, 'día', 'días')} · ${p.trimester}.º trimestre</span>
    </div>
  </div>
  <section class="card baby">
    <div class="hero-ic baby-ic">${icon('baby')}</div>
    <div><h2>Tu bebé</h2><p>Tiene aproximadamente el tamaño de <b>${size}</b>.</p></div>
  </section>
  <section class="card">
    <ul class="list">
      <li>${badge('baby', 'preg')}<span>Fecha probable de parto</span><b>${fmtLong(p.due)}</b></li>
      <li>${badge('hourglass', 'preg')}<span>Faltan</span><b>${p.daysLeft > 0 ? plural(p.daysLeft, 'día', 'días') : '¡Ya es el momento!'}</b></li>
      <li>${badge('calendar-days', 'preg')}<span>Última regla</span><b>${fmt(p.lmp, { day: 'numeric', month: 'long', year: 'numeric' })}</b></li>
    </ul>
    <div class="progress"><span style="width:${(p.progress * 100).toFixed(1)}%"></span></div>
  </section>`;
}

export function render() {
  const s = getState();
  const t = todayKey();
  const hello = s.profile.name ? `Hola, ${esc(s.profile.name)}` : 'Hola';
  let body;

  if (s.profile.goal === 'pregnant') {
    body = pregnancyView(s) + todayLogCard();
  } else {
    const stats = computeStats(s);
    const pred = predict(s, t, stats);
    if (!pred) {
      body = `
      <section class="card accent">
        <h2>Registra tu último periodo</h2>
        <p class="muted">Con la fecha de inicio de tu último periodo podremos predecir los siguientes y tu ventana fértil.</p>
        <button class="btn primary" data-act="period-today">Mi periodo empezó hoy</button>
        <a class="btn ghost" href="#/calendar/edit">Elegir fechas en el calendario</a>
      </section>`;
    } else {
      const map = buildDayMap(s, stats, pred, t);
      let center;
      if (pred.inPeriod) center = `<small>Periodo</small><strong>Día ${pred.periodDay}</strong><span>Ciclo día ${pred.cycleDay}</span>`;
      else if (pred.late > 0) center = `<small>Retraso</small><strong>${plural(pred.late, 'día', 'días')}</strong><span>¿Ya llegó tu periodo?</span>`;
      else if (pred.daysUntil === 0) center = `<small>Periodo</small><strong>Hoy</strong><span>Previsto para hoy</span>`;
      else center = `<small>Periodo en</small><strong>${pred.daysUntil === 1 ? '1 día' : `${pred.daysUntil} días`}</strong><span>${PHASES[pred.phase].name}</span>`;
      center += `<em class="chance chance-${pred.chance}">Probabilidad de embarazo ${pred.chance}</em>`;

      const periodBtn = pred.inPeriod
        ? `<a class="btn secondary" href="#/calendar/edit">Editar fechas del periodo</a>`
        : `<button class="btn primary" data-act="period-today">Mi periodo empezó hoy</button>`;
      body = weekStrip(map) + cycleRing(pred, map, center)
        + `<div class="center-actions">${periodBtn}</div>`
        + todayLogCard() + upcomingCard(pred) + phaseCard(pred);
    }
  }

  return {
    html: `
    <header class="topbar">
      <div><p class="eyebrow">${fmtLong(t)}</p><h1>${hello}</h1></div>
      <a href="#/calendar" class="icon-btn" aria-label="Calendario">${icon('calendar')}</a>
    </header>
    ${notifCard(s)}
    ${body}
    ${installCard()}
    <p class="disclaimer">Las predicciones son estimaciones y no sustituyen el consejo médico ni un método anticonceptivo.</p>`,
    bind(root) {
      root.querySelector('[data-act=period-today]')?.addEventListener('click', () => {
        setPeriodDay(t, true);
        toast('Periodo registrado. Tus predicciones se han actualizado');
      });
      root.querySelector('[data-act=install-help]')?.addEventListener('click', () => {
        const h = installHelp();
        modal(`<h2>${h.title}</h2><ol class="install-steps">${h.steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
          ${h.note ? `<p class="status">${h.note}</p>` : ''}<div class="row-end"><button class="btn primary" data-close>Entendido</button></div>`);
      });
      root.querySelector('[data-act=install]')?.addEventListener('click', async () => {
        const e = window.lunaraInstall;
        if (!e) return;
        e.prompt();
        await e.userChoice;
        window.lunaraInstall = null;
        window.dispatchEvent(new Event('rerender'));
      });
    },
  };
}
