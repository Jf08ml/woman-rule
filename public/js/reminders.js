// Construye la agenda de notificaciones a partir del estado local.
// Solo esta agenda (fecha/hora + texto) se envía al servidor push.
import { addDays, atTime, diffDays, fmt, todayKey } from './dates.js';
import { predict, pregnancyInfo } from './cycle.js';
import { babyFor } from './catalog.js';
import { contraceptionPlan, takesPill } from './health.js';

export const REMINDER_INFO = [
  { key: 'periodBefore', title: 'Periodo próximo', desc: 'Aviso días antes de tu periodo' },
  { key: 'periodStart', title: 'Inicio del periodo', desc: 'El día estimado de inicio' },
  { key: 'periodLate', title: 'Periodo retrasado', desc: 'Si no registras tu periodo a tiempo' },
  { key: 'fertile', title: 'Ventana fértil', desc: 'Cuando empieza tu ventana fértil' },
  { key: 'ovulation', title: 'Ovulación', desc: 'El día estimado de ovulación' },
  { key: 'pill', title: 'Mi anticonceptivo', desc: 'Píldora, parche, anillo, inyección o revisión del dispositivo', time: true },
  { key: 'logDaily', title: 'Registrar síntomas', desc: 'Recordatorio diario para registrar', time: true },
  { key: 'bbt', title: 'Temperatura basal', desc: 'Mide tu temperatura al despertar', time: true },
  { key: 'water', title: 'Beber agua', desc: 'Varias veces al día', times: true },
  { key: 'pregnancyWeekly', title: 'Embarazo semana a semana', desc: 'Novedades de tu embarazo cada semana' },
];

// Recordatorios del método anticonceptivo según su calendario
function methodReminders(state, { add, daily, msg }) {
  const r = state.reminders;
  const t = todayKey();
  const at = r.pill.time || '21:00';
  const pillDaily = () => daily.push({ id: 'pill', time: at, tag: 'pill', url: '/#/log', ...msg('Hora de tu píldora', 'No olvides tomar tu anticonceptivo de hoy.') });
  const plan = contraceptionPlan(state, t);
  if (!plan || plan.needsDate) {
    if (takesPill(state.profile, r)) pillDaily();
    return;
  }
  if (plan.kind === 'daily') { pillDaily(); return; }
  if (plan.kind === 'pack') {
    const id = plan.method.id;
    const packs = plan.packs.slice(0, 4);
    if (id === 'pill') {
      if (!plan.pause) pillDaily();
      else {
        // 21 + 7: solo los días con píldora durante las próximas 9 semanas (se renueva al abrir la app)
        for (let i = 0; i < 63; i++) {
          const d = addDays(t, i);
          const day = ((diffDays(plan.start, d) % 28) + 28) % 28 + 1;
          if (day <= plan.active) add(`pill:${d}`, d, 'pill', msg('Hora de tu píldora', day === 1 ? 'Hoy empiezas un blíster nuevo.' : 'No olvides tomar tu anticonceptivo de hoy.'), '/#/log', at);
        }
        add('pill:renew', addDays(t, 60), 'pill', msg('Abre Lunara', 'Abre la app para seguir recibiendo los avisos de tu píldora.'), '/#/today', at);
      }
      if (!plan.continuous) packs.forEach((p) => {
        add(`pk:${p.breakStart}`, p.breakStart, 'pill', msg(plan.pause ? 'Empieza tu semana de descanso' : 'Empiezan tus píldoras placebo', 'Es normal que tengas un sangrado en los próximos días.'), '/#/today', at);
        if (plan.pause) add(`pk:${p.nextPack}`, addDays(p.nextPack, -1), 'pill', msg('Mañana empiezas blíster nuevo', 'Aunque sigas sangrando, empieza el blíster el día que toca.'), '/#/today', at);
      });
      return;
    }
    const word = id === 'patch' ? 'parche' : 'anillo';
    packs.forEach((p) => {
      if (id === 'patch') {
        const days = plan.continuous ? [0, 7, 14, 21] : [0, 7, 14];
        days.forEach((k) => add(`pt:${addDays(p.packStart, k)}`, addDays(p.packStart, k), 'pill', msg(k ? 'Cambia tu parche' : 'Pon un parche nuevo', 'Colócalo en una zona limpia y seca, distinta a la anterior.'), '/#/today', at));
      } else {
        add(`rg:${p.packStart}`, p.packStart, 'pill', msg(plan.continuous ? 'Cambia tu anillo' : 'Coloca un anillo nuevo', 'Hoy toca tu anillo vaginal.'), '/#/today', at);
      }
      if (!plan.continuous) add(`rm:${p.breakStart}`, p.breakStart, 'pill', msg(`Retira tu ${word}`, `Empieza tu semana sin ${word}. Es normal que tengas un sangrado.`), '/#/today', at);
    });
    return;
  }
  if (plan.kind === 'injection') {
    add(`inj:${plan.next}:2`, addDays(plan.next, -2), 'pill', msg('Tu inyección es en 2 días', `Toca el ${fmt(plan.next, { weekday: 'long', day: 'numeric', month: 'long' })}. Pide tu cita si la necesitas.`), '/#/today', at);
    add(`inj:${plan.next}`, plan.next, 'pill', msg('Hoy toca tu inyección', 'Póntela hoy para mantener la protección. Después actualiza la fecha en Lunara.'), '/#/today', at);
    return;
  }
  if (plan.kind === 'device') {
    const name = plan.method.label.startsWith('DIU') ? plan.method.label : plan.method.label.toLowerCase();
    add(`dev:${plan.expiry}:60`, addDays(plan.expiry, -60), 'pill', msg(`Tu ${name} vence pronto`, 'Pide cita para revisarlo o cambiarlo. La duración exacta depende del modelo.'), '/#/today', at);
    add(`dev:${plan.expiry}`, plan.expiry, 'pill', msg(`Revisa tu ${name}`, 'Según la fecha de colocación, hoy se cumple su duración habitual.'), '/#/today', at);
  }
}

export function buildSchedule(state, now = new Date()) {
  const r = state.reminders;
  const oneOff = [];
  const daily = [];
  if (!r.enabled) return { oneOff, daily };

  const discreet = state.settings.discreet;
  const name = state.profile.name ? `, ${state.profile.name}` : '';
  const goal = state.profile.goal;
  const msg = (title, body) => (discreet ? { title: 'Lunara', body: 'Tienes un recordatorio nuevo' } : { title, body });
  const time = r.time || '09:00';
  const nowMs = now.getTime();
  const add = (id, dateKey, tag, m, url = '/#/today', at = time) => {
    const when = atTime(dateKey, at).getTime();
    if (when > nowMs) oneOff.push({ id, at: when, tag, url, ...m });
  };

  if (goal === 'pregnant') {
    const p = pregnancyInfo(state);
    if (p && r.pregnancyWeekly.on) {
      for (let w = Math.max(1, p.week + 1); w <= 42; w++) {
        const size = babyFor(w);
        add(`preg:${w}`, addDays(p.lmp, w * 7), 'pregnancy',
          msg(`¡Semana ${w} de embarazo!`, w >= 4 ? `Tu bebé tiene el tamaño de ${size}. Mira las novedades de esta semana.` : 'Mira las novedades de esta semana.'));
      }
    }
  } else {
    const pred = predict(state);
    const plan = contraceptionPlan(state);
    // Con blíster/parche/anillo con fecha, los avisos de sangrado los da el calendario del método
    const packScheduled = plan?.kind === 'pack' && !plan.needsDate;
    if (pred) {
      const today = todayKey();
      pred.upcoming.forEach((c, i) => {
        if (packScheduled || pred.mode === 'hormonal') return; // con métodos hormonales el sangrado no es predecible
        const start = i === 0 && pred.late === 0 ? pred.expected : c.periodStart;
        if (i === 0 && pred.late > 0) return; // ya está retrasado: no reprogramar avisos previos
        if (r.periodBefore.on && r.periodBefore.days > 0) {
          const d = r.periodBefore.days;
          add(`pb:${start}`, addDays(start, -d), 'period-before',
            msg(`Tu periodo llega en ${d === 1 ? '1 día' : `${d} días`}`, `Fecha estimada: ${fmt(start, { weekday: 'long', day: 'numeric', month: 'long' })}. Ten a mano lo que necesites${name}.`));
        }
        if (r.periodStart.on) {
          add(`ps:${start}`, start, 'period-start',
            msg('Hoy podría empezar tu periodo', '¿Ya llegó? Regístralo para mejorar tus predicciones.'), '/#/log');
        }
        if (!pred.fertility) return;
        if (r.fertile.on && c.fertileStart > today && !(i === 0 && pred.inPeriod && c.fertileStart <= pred.last.end)) {
          add(`fe:${c.fertileStart}`, c.fertileStart, 'fertile',
            goal === 'conceive'
              ? msg('Empieza tu ventana fértil', 'Los próximos días tienes más probabilidades de concebir.')
              : state.profile.sexActive === false
                ? msg('Empieza tu ventana fértil', 'Puede que notes más energía y un flujo más elástico estos días.')
                : msg('Empieza tu ventana fértil', 'Probabilidad de embarazo más alta durante los próximos días.'));
        }
        if (r.ovulation.on) {
          add(`ov:${c.ovulation}`, c.ovulation, 'ovulation',
            msg('Hoy es tu día estimado de ovulación', goal === 'conceive' ? 'Es el día de mayor fertilidad de tu ciclo.' : 'Día de mayor fertilidad estimada.'));
        }
      });
      // Retraso: 2 días después de la fecha estimada (o del final del rango si es irregular) y otro a los 7 días.
      // No aplica con métodos hormonales ni en posparto/lactancia, donde el periodo puede no llegar.
      const noLate = pred.mode !== 'natural' || ['postpartum', 'breastfeeding'].includes(state.profile.situation);
      if (r.periodLate.on && !pred.inPeriod && !noLate) {
        const from = pred.range ? pred.range.end : pred.expected;
        const hint = state.profile.sexActive === false
          ? 'El estrés, el sueño o los cambios de peso pueden retrasarlo.'
          : 'Si tuviste relaciones sin protección, considera una prueba de embarazo.';
        [2, 7].forEach((d) => add(`pl:${from}:${d}`, addDays(from, d), 'period-late',
          msg(`Tu periodo lleva ${d} días de retraso`, `¿Ya llegó? Regístralo. ${hint}`), '/#/log'));
      }
    }
  }

  if (r.pill.on) methodReminders(state, { add, daily, msg });
  if (r.logDaily.on) daily.push({ id: 'log', time: r.logDaily.time, tag: 'log', url: '/#/log', ...msg('¿Cómo te sientes hoy?', 'Registra tus síntomas y estado de ánimo en 10 segundos.') });
  if (r.bbt.on) daily.push({ id: 'bbt', time: r.bbt.time, tag: 'bbt', url: '/#/log', ...msg('Temperatura basal', 'Mídela antes de levantarte y regístrala.') });
  if (r.water.on) {
    r.water.times.forEach((t, i) => daily.push({ id: `water${i}`, time: t, tag: 'water', url: '/#/log', ...msg('Hora de hidratarte', 'Bebe un vaso de agua.') }));
  }

  oneOff.sort((a, b) => a.at - b.at);
  return { oneOff: oneOff.slice(0, 250), daily };
}
