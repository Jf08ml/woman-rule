import { getState, getLog, setLog, setPeriodDay, update } from '../store.js';
import { computeStats, predict, buildDayMap, pregnancyInfo } from '../cycle.js';
import { todayKey, addDays, diffDays, fmt, fmtLong, fromKey, plural } from '../dates.js';
import { PHASES, SYMPTOMS, MOODS, FLOW, babyFor, label, option, madeLove } from '../catalog.js';
import { icon, badge } from '../icons.js';
import { esc, toast, modal } from '../ui.js';
import { isIOS, isStandalone } from '../push.js';
import { installHelp } from './install.js';
import { contraceptionPlan, takesPill, pregnancyWeight, SITUATION_NOTES } from '../health.js';

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

function guideCard(s) {
  if (s.settings.guideSeen) return '';
  return `
  <a class="card link-card" href="#/guide">
    ${badge('book-open')}
    <span><b>¿Primera vez en Lunara?</b><small>Descubre cómo usarla en la guía</small></span>
    ${icon('chevron-right')}
  </a>`;
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

function phaseCard(pred, s) {
  const p = PHASES[pred.phase];
  const tips = s.profile.sexActive === false ? p.tips.filter((x) => !/relaciones|embarazo/i.test(x)) : p.tips;
  return `
  <section class="card">
    <div class="card-head"><h2>${p.name}</h2><span class="pill phase-${pred.phase}">Ciclo día ${pred.cycleDay}</span></div>
    <p>${p.desc}</p>
    <ul class="tips">${tips.map((x) => `<li>${x}</li>`).join('')}</ul>
  </section>`;
}

function upcomingCard(pred, pack) {
  const t = todayKey();
  const rows = [];
  const next = pred.upcoming[0];
  const word = pred.mode === 'natural' ? 'Próximo periodo' : 'Próximo sangrado';
  let when = fmtLong(next.periodStart);
  if (pred.late) when = `Retraso de ${plural(pred.late, 'día', 'días')}`;
  else if (pred.phase === 'waiting') when = 'Sin fecha fija';
  else if (pred.range && !pred.inPeriod && pred.range.end >= t) {
    when = pred.range.start <= t ? `Cualquier día hasta el ${fmt(pred.range.end)}` : `Entre el ${fmt(pred.range.start)} y el ${fmt(pred.range.end)}`;
  }
  if (!pack) rows.push(['droplet', word, when]);
  const fw = pred.fertility && [pred.current, ...pred.upcoming].find((w) => w.fertileEnd >= t && !(pred.inPeriod && w === pred.current && w.fertileStart <= pred.last.end));
  if (fw) {
    rows.push(['flower-2', 'Ventana fértil', `${fmt(fw.fertileStart)} – ${fmt(fw.fertileEnd)}`]);
    rows.push(['sparkles', 'Ovulación', fw.ovulation === t ? 'Hoy' : fmtLong(fw.ovulation)]);
  }
  if (!pack) rows.push(['calendar-days', 'Siguiente', fmt(pred.upcoming[1].periodStart, { day: 'numeric', month: 'long' })]);
  if (!rows.length) return '';
  return `
  <section class="card">
    <h2>Próximas fechas</h2>
    <ul class="list">${rows.map(([i, k, v]) => `<li>${badge(i, i === 'droplet' || i === 'calendar-days' ? 'primary' : 'fertile')}<span>${k}</span><b>${v}</b></li>`).join('')}</ul>
    ${pred.irregular && !pack ? `<p class="muted small">Te mostramos un rango porque ${esc(pred.irregular)}.</p>` : ''}
    ${pred.mode === 'hormonal' ? '<p class="muted small">Con tu método el sangrado puede ser irregular o desaparecer: es una estimación aproximada.</p>' : ''}
  </section>`;
}

const PACK_WORD = { pill: 'Blíster', patch: 'Parche', ring: 'Anillo' };

function packCenter(plan) {
  const w = PACK_WORD[plan.method.id];
  if (plan.inBreak) {
    const label = plan.pause ? 'Semana de descanso' : 'Píldoras placebo';
    return `<small>${label}</small><strong>Día ${plan.day - plan.active}</strong><span>${w} nuevo: ${fmt(plan.current.nextPack)}</span>`;
  }
  const left = plan.active - plan.day + 1;
  return `<small>${w}</small><strong>Día ${plan.day}</strong><span>${plan.pause || plan.method.id !== 'pill' ? 'Descanso' : 'Placebo'} en ${plural(left, 'día', 'días')}</span>`;
}

function packPhaseCard(plan) {
  const p = PHASES[plan.inBreak ? 'packBreak' : 'packActive'];
  return `
  <section class="card">
    <div class="card-head"><h2>${p.name}</h2><span class="pill phase-${plan.inBreak ? 'menstrual' : 'luteal'}">Día ${plan.day} de 28</span></div>
    <p>${p.desc}</p>
    <ul class="tips">${p.tips.map((x) => `<li>${x}</li>`).join('')}</ul>
  </section>`;
}

/** Tarjeta del método anticonceptivo: calendario, próxima toma/cambio y botón rápido. */
function methodCard(s, plan) {
  const t = todayKey();
  const log = getLog(t);
  const pillToday = takesPill(s.profile, s.reminders) && !(plan?.kind === 'pack' && plan.inBreak && plan.pause);
  const pillBtn = pillToday
    ? (log.pill ? `<p class="status ok">${icon('circle-check')} Píldora de hoy tomada</p>` : `<button class="btn primary block" data-act="pill-today">${icon('pill')} Tomé mi píldora de hoy</button>`)
    : '';
  if (!plan) return pillBtn ? `<section class="card"><h2 class="h-ic">${icon('pill')} Mi píldora</h2>${pillBtn}</section>` : '';
  const m = plan.method;
  const head = `<div class="card-head"><h2 class="h-ic">${icon(m.icon)} ${esc(m.label)}</h2><a class="link" href="#/settings/health">Editar</a></div>`;
  if (plan.needsDate) {
    const what = plan.kind === 'pack' ? (m.id === 'pill' ? 'en que empezaste el blíster' : 'del primer parche o anillo del ciclo')
      : plan.kind === 'injection' ? 'de tu última inyección' : 'de colocación';
    if (plan.kind === 'pack' && plan.type === 'continuous') return pillBtn ? `<section class="card">${head}${pillBtn}</section>` : '';
    return `<section class="card">${head}<p class="muted">Añade la fecha ${what} para calcular tu calendario y recordarte cada toma o cambio.</p>
      <a class="btn secondary" href="#/settings/health">Añadir fecha</a>${pillBtn}</section>`;
  }
  const rows = [];
  if (plan.kind === 'pack') {
    const c = plan.current;
    if (plan.continuous) rows.push(['calendar-days', 'Uso continuo', `Día ${plan.day}`]);
    else if (plan.inBreak) rows.push(['calendar-days', `${PACK_WORD[m.id]} nuevo`, fmtLong(c.nextPack)]);
    else rows.push(['calendar-days', plan.pause ? 'Empieza el descanso' : 'Empiezan los placebos', fmtLong(c.breakStart)]);
    if (m.id === 'patch') {
      const changes = [0, 7, 14, ...(plan.continuous ? [21] : [])].map((k) => addDays(c.packStart, k)).concat([c.nextPack]);
      const nextChange = changes.find((d) => d >= t);
      if (nextChange && !plan.inBreak) rows.push(['square-plus', 'Próximo cambio de parche', nextChange === t ? 'Hoy' : fmtLong(nextChange)]);
    }
    if (!plan.continuous) {
      const b = plan.bleeds.find((x) => x.bleedEnd >= t);
      if (b) rows.push(['droplet', 'Sangrado previsto', b.bleedStart <= t ? 'Estos días' : fmtLong(b.bleedStart)]);
    }
  } else if (plan.kind === 'injection') {
    const d = plan.daysLeft;
    rows.push(['syringe', 'Próxima inyección', d === 0 ? 'Hoy' : d > 0 ? `${fmt(plan.next)} · en ${plural(d, 'día', 'días')}` : `Retrasada ${plural(-d, 'día', 'días')}`]);
  } else if (plan.kind === 'device') {
    rows.push(['calendar-days', 'Colocado', fmt(plan.placed, { day: 'numeric', month: 'short', year: 'numeric' })]);
    rows.push(['hourglass', 'Revisión o cambio', fmt(plan.expiry, { day: 'numeric', month: 'short', year: 'numeric' })]);
  }
  let warn = '';
  if (plan.kind === 'injection' && plan.daysLeft < 0) warn = '<p class="status warn">Si te retrasaste con la inyección, usa preservativo y consulta si necesitas protección adicional.</p>';
  else if (plan.kind === 'injection' && plan.daysLeft <= 3) warn = '<p class="status warn">Tu inyección está cerca: pide tu cita si la necesitas.</p>';
  if (plan.kind === 'device' && plan.daysLeft <= 60) warn = `<p class="status warn">${plan.daysLeft < 0 ? 'Ya pasó' : 'Se acerca'} la duración habitual de tu método. Consulta para revisarlo o cambiarlo.</p>`;
  return `
  <section class="card">
    ${head}
    <ul class="list">${rows.map(([i, k, v]) => `<li>${badge(i)}<span>${k}</span><b>${v}</b></li>`).join('')}</ul>
    ${warn}
    ${plan.kind === 'injection' && plan.daysLeft <= 7 ? `<button class="btn secondary block" data-act="injection-today">${icon('syringe')} Me la puse hoy</button>` : ''}
    ${pillBtn}
  </section>`;
}

function healthPromptCard(s) {
  if (s.settings.healthAsked) return '';
  return `
  <section class="card accent">
    <div class="card-icon">${badge('stethoscope')}</div>
    <h2>Personaliza tus predicciones</h2>
    <p class="muted">Cuéntanos tu método anticonceptivo, tu edad y otros datos opcionales. Así no te mostraremos una ventana fértil si tu método la evita y te avisaremos de tus tomas.</p>
    <div class="row wrap">
      <a class="btn primary" href="#/settings/health">Completar perfil</a>
      <button class="btn ghost" data-act="health-dismiss">Ahora no</button>
    </div>
  </section>`;
}

function situationCard(s) {
  const note = SITUATION_NOTES[s.profile.situation];
  return note ? `<section class="card"><p class="h-ic muted">${icon('info')} ${note}</p></section>` : '';
}

function pregnancyWeightCard(s, p) {
  const w = pregnancyWeight(s, p);
  if (!w) {
    return `<section class="card"><h2 class="h-ic">${icon('weight')} Peso en el embarazo</h2>
      <p class="muted small">Añade tu estatura y tu peso antes del embarazo en Perfil para ver cuánto peso conviene ganar cada semana.</p>
      <a class="btn secondary" href="#/settings/health">Añadir datos</a></section>`;
  }
  const status = { below: ['warn', 'Por debajo de lo esperado para tu semana'], above: ['warn', 'Por encima de lo esperado para tu semana'], ok: ['ok', 'Dentro de lo esperado'] }[w.status];
  return `
  <section class="card">
    <h2 class="h-ic">${icon('weight')} Peso en el embarazo</h2>
    <ul class="list">
      <li>${badge('scale', 'preg')}<span>Ganado hasta ahora</span><b>${w.gain === null ? 'Registra tu peso' : `${w.gain > 0 ? '+' : ''}${w.gain} kg`}</b></li>
      <li>${badge('target', 'preg')}<span>Esperado en la semana ${p.week}</span><b>${w.expected[0]} – ${w.expected[1]} kg</b></li>
      <li>${badge('baby', 'preg')}<span>Total recomendado</span><b>${w.total[0]} – ${w.total[1]} kg</b></li>
    </ul>
    ${status ? `<p class="status ${status[0]}">${status[1]}</p>` : ''}
    <p class="muted small">Según tu IMC antes del embarazo (${w.preBmi}). Son rangos orientativos: tu equipo médico puede darte otros.</p>
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
    body = pregnancyView(s) + pregnancyWeightCard(s, pregnancyInfo(s)) + todayLogCard();
  } else {
    const stats = computeStats(s);
    const pred = predict(s, t, stats);
    const plan = contraceptionPlan(s, t);
    const pack = plan?.kind === 'pack' && !plan.needsDate && !plan.continuous ? plan : null;
    if (!pred && !pack) {
      body = `
      <section class="card accent">
        <h2>Registra tu último periodo</h2>
        <p class="muted">Con la fecha de inicio de tu último periodo podremos predecir los siguientes y tu ventana fértil.</p>
        <button class="btn primary" data-act="period-today">Mi periodo empezó hoy</button>
        <a class="btn ghost" href="#/calendar/edit">Elegir fechas en el calendario</a>
      </section>` + methodCard(s, plan) + situationCard(s);
    } else {
      const map = buildDayMap(s, stats, pred, t, plan);
      const showChance = s.profile.sexActive !== false;
      let center;
      let ring;
      if (pred?.inPeriod) center = `<small>${pred.mode === 'natural' ? 'Periodo' : 'Sangrado'}</small><strong>Día ${pred.periodDay}</strong><span>Ciclo día ${pred.cycleDay}</span>`;
      else if (pack) center = packCenter(pack);
      else if (!pred.fertility) center = `<small>Ciclo día</small><strong>${pred.cycleDay}</strong><span>Sangrado aprox. ${pred.daysUntil <= 0 ? 'en estos días' : `en ${plural(pred.daysUntil, 'día', 'días')}`}</span>`;
      else if (pred.late > 0) center = `<small>Retraso</small><strong>${plural(pred.late, 'día', 'días')}</strong><span>¿Ya llegó tu periodo?</span>`;
      else if (pred.phase === 'waiting') center = `<small>Ciclo día</small><strong>${pred.cycleDay}</strong><span>Tu periodo puede tardar en volver</span>`;
      else if (pred.phase === 'due' && pred.range) center = `<small>Periodo</small><strong>Cualquier día</strong><span>Hasta el ${fmt(pred.range.end)}</span>`;
      else if (pred.daysUntil === 0) center = `<small>Periodo</small><strong>Hoy</strong><span>Previsto para hoy</span>`;
      else center = `<small>Periodo en</small><strong>${pred.range ? '≈ ' : ''}${pred.daysUntil === 1 ? '1 día' : `${pred.daysUntil} días`}</strong><span>${PHASES[pred.phase].name}</span>`;
      if (showChance) {
        if (pred?.chance) center += `<em class="chance chance-${pred.chance}">Probabilidad de embarazo ${pred.chance}</em>`;
        else if (plan || pred?.mode !== 'natural') center += '<em class="chance">Protegida con tu método*</em>';
      }
      if (pack && !pred?.inPeriod) ring = cycleRing({ last: { start: pack.current.packStart }, avgCycle: 28, cycleDay: pack.day }, map, center);
      else ring = cycleRing(pred, map, center);

      const periodBtn = pred?.inPeriod
        ? `<a class="btn secondary" href="#/calendar/edit">Editar fechas del periodo</a>`
        : `<button class="btn primary" data-act="period-today">${pack || pred?.mode !== 'natural' ? 'Empecé a sangrar hoy' : 'Mi periodo empezó hoy'}</button>`;
      body = weekStrip(map) + ring
        + `<div class="center-actions">${periodBtn}</div>`
        + methodCard(s, plan) + situationCard(s) + todayLogCard()
        + (pred ? upcomingCard(pred, pack) : '')
        + (pack ? packPhaseCard(pack) : phaseCard(pred, s));
    }
  }

  return {
    html: `
    <header class="topbar">
      <div><p class="eyebrow">${fmtLong(t)}</p><h1>${hello}</h1></div>
      <div class="row">
        <a href="#/guide" class="icon-btn" aria-label="Guía de uso">${icon('circle-help')}</a>
        <a href="#/calendar" class="icon-btn" aria-label="Calendario">${icon('calendar')}</a>
      </div>
    </header>
    ${guideCard(s)}
    ${s.profile.goal === 'pregnant' ? '' : healthPromptCard(s)}
    ${notifCard(s)}
    ${body}
    ${installCard()}
    <p class="disclaimer">${s.profile.contraception && !['none', 'condom', 'natural', 'other', 'iud-copper'].includes(s.profile.contraception) ? '*Con uso correcto del método. ' : ''}Las predicciones son estimaciones y no sustituyen el consejo médico ni un método anticonceptivo.</p>`,
    bind(root) {
      root.querySelector('[data-act=period-today]')?.addEventListener('click', () => {
        setPeriodDay(t, true);
        toast('Periodo registrado. Tus predicciones se han actualizado');
      });
      root.querySelector('[data-act=pill-today]')?.addEventListener('click', () => { setLog(t, { pill: true }); toast('Píldora registrada'); });
      root.querySelector('[data-act=injection-today]')?.addEventListener('click', () => {
        update((st) => { st.profile.methodDate = t; });
        toast('Inyección registrada: te avisaremos de la siguiente');
      });
      root.querySelector('[data-act=health-dismiss]')?.addEventListener('click', () => update((st) => { st.settings.healthAsked = true; }));
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
