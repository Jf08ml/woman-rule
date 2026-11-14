// Construye la agenda de notificaciones a partir del estado local.
// Solo esta agenda (fecha/hora + texto) se envía al servidor push.
import { addDays, atTime, fmt, todayKey } from './dates.js';
import { predict, pregnancyInfo } from './cycle.js';
import { babyFor } from './catalog.js';

export const REMINDER_INFO = [
  { key: 'periodBefore', title: 'Periodo próximo', desc: 'Aviso días antes de tu periodo' },
  { key: 'periodStart', title: 'Inicio del periodo', desc: 'El día estimado de inicio' },
  { key: 'periodLate', title: 'Periodo retrasado', desc: 'Si no registras tu periodo a tiempo' },
  { key: 'fertile', title: 'Ventana fértil', desc: 'Cuando empieza tu ventana fértil' },
  { key: 'ovulation', title: 'Ovulación', desc: 'El día estimado de ovulación' },
  { key: 'pill', title: 'Píldora anticonceptiva', desc: 'Todos los días a la misma hora', time: true },
  { key: 'logDaily', title: 'Registrar síntomas', desc: 'Recordatorio diario para registrar', time: true },
  { key: 'bbt', title: 'Temperatura basal', desc: 'Mide tu temperatura al despertar', time: true },
  { key: 'water', title: 'Beber agua', desc: 'Varias veces al día', times: true },
  { key: 'pregnancyWeekly', title: 'Embarazo semana a semana', desc: 'Novedades de tu embarazo cada semana' },
];

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
    if (pred) {
      const today = todayKey();
      pred.upcoming.forEach((c, i) => {
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
        if (r.fertile.on && c.fertileStart > today && !(i === 0 && pred.inPeriod && c.fertileStart <= pred.last.end)) {
          add(`fe:${c.fertileStart}`, c.fertileStart, 'fertile',
            goal === 'conceive'
              ? msg('Empieza tu ventana fértil', 'Los próximos días tienes más probabilidades de concebir.')
              : msg('Empieza tu ventana fértil', 'Probabilidad de embarazo más alta durante los próximos días.'));
        }
        if (r.ovulation.on) {
          add(`ov:${c.ovulation}`, c.ovulation, 'ovulation',
            msg('Hoy es tu día estimado de ovulación', goal === 'conceive' ? 'Es el día de mayor fertilidad de tu ciclo.' : 'Día de mayor fertilidad estimada.'));
        }
      });
      // Retraso: 2 días después de la fecha estimada (y otro a los 7 días)
      if (r.periodLate.on && !pred.inPeriod) {
        [2, 7].forEach((d) => add(`pl:${pred.expected}:${d}`, addDays(pred.expected, d), 'period-late',
          msg(`Tu periodo lleva ${d} días de retraso`, '¿Ya llegó? Regístralo. Si tuviste relaciones sin protección, considera una prueba de embarazo.'), '/#/log'));
      }
    }
  }

  if (r.pill.on) daily.push({ id: 'pill', time: r.pill.time, tag: 'pill', url: '/#/log', ...msg('Hora de tu píldora', 'No olvides tomar tu anticonceptivo de hoy.') });
  if (r.logDaily.on) daily.push({ id: 'log', time: r.logDaily.time, tag: 'log', url: '/#/log', ...msg('¿Cómo te sientes hoy?', 'Registra tus síntomas y estado de ánimo en 10 segundos.') });
  if (r.bbt.on) daily.push({ id: 'bbt', time: r.bbt.time, tag: 'bbt', url: '/#/log', ...msg('Temperatura basal', 'Mídela antes de levantarte y regístrala.') });
  if (r.water.on) {
    r.water.times.forEach((t, i) => daily.push({ id: `water${i}`, time: t, tag: 'water', url: '/#/log', ...msg('Hora de hidratarte', 'Bebe un vaso de agua.') }));
  }

  oneOff.sort((a, b) => a.at - b.at);
  return { oneOff: oneOff.slice(0, 250), daily };
}
