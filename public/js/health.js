// Perfil de salud: catálogos y reglas que adaptan predicciones, avisos y consejos
// según el método anticonceptivo, la edad, el IMC, la regularidad, la etapa de vida y las condiciones.
// Todo se calcula en el dispositivo; nada de esto se envía al servidor.
import { addDays, diffDays, todayKey, isValidKey } from './dates.js';

// mode: 'natural' = hay ovulación (predicciones completas)
//       'pack'    = píldora/parche/anillo combinados: no hay ovulación, el sangrado sigue el blíster
//       'hormonal'= método hormonal sin calendario fijo: no hay ventana fértil y el sangrado puede ser irregular
export const CONTRACEPTION = [
  { id: 'none', label: 'Ninguno', icon: 'circle-slash', desc: 'No uso método anticonceptivo', mode: 'natural' },
  { id: 'condom', label: 'Preservativo', icon: 'shield', desc: 'Condón masculino o femenino', mode: 'natural' },
  { id: 'pill', label: 'Píldora combinada', icon: 'pill', desc: 'Estrógeno + progestágeno', mode: 'pack', combined: true },
  { id: 'minipill', label: 'Minipíldora', icon: 'pill', desc: 'Solo progestágeno, se toma todos los días', mode: 'hormonal' },
  { id: 'patch', label: 'Parche', icon: 'square-plus', desc: 'Uno por semana, 3 semanas', mode: 'pack', combined: true },
  { id: 'ring', label: 'Anillo vaginal', icon: 'circle-dashed', desc: '3 semanas puesto, 1 de descanso', mode: 'pack', combined: true },
  { id: 'injection', label: 'Inyección', icon: 'syringe', desc: 'Mensual o trimestral', mode: 'hormonal' },
  { id: 'implant', label: 'Implante subdérmico', icon: 'activity', desc: 'Varilla en el brazo', mode: 'hormonal', years: 3 },
  { id: 'iud-hormonal', label: 'DIU hormonal', icon: 'shield-check', desc: 'Libera progestágeno', mode: 'hormonal', years: 5 },
  { id: 'iud-copper', label: 'DIU de cobre', icon: 'shield-check', desc: 'T de cobre, sin hormonas', mode: 'natural', years: 10 },
  { id: 'natural', label: 'Métodos naturales', icon: 'thermometer', desc: 'Calendario, temperatura o moco cervical', mode: 'natural' },
  { id: 'other', label: 'Otro', icon: 'circle-dot', desc: 'Otro método', mode: 'natural' },
];

export const PACK_TYPES = [
  { id: '21-7', label: '21 píldoras + 7 días de descanso', pause: true },
  { id: '28', label: '28 píldoras (21 activas + 7 placebo)' },
  { id: '24-4', label: '28 píldoras (24 activas + 4 placebo)' },
  { id: 'continuous', label: 'Uso continuo, sin descanso' },
];

export const REGULARITY = [
  { id: 'regular', label: 'Regulares', icon: 'calendar-days', desc: 'Llegan más o menos cuando las espero' },
  { id: 'irregular', label: 'Irregulares', icon: 'shuffle', desc: 'Varían mucho de un mes a otro' },
  { id: 'unknown', label: 'No lo sé', icon: 'circle-help', desc: 'Lunara lo aprenderá con tus registros' },
];

export const SITUATIONS = [
  { id: 'none', label: 'Ninguna de estas', icon: 'circle-check' },
  { id: 'postpill', label: 'Dejé un anticonceptivo hormonal hace menos de 3 meses', icon: 'pill' },
  { id: 'postpartum', label: 'Di a luz hace menos de un año', icon: 'baby' },
  { id: 'breastfeeding', label: 'Estoy dando lactancia', icon: 'milk' },
  { id: 'perimenopause', label: 'Creo que estoy en la perimenopausia', icon: 'flame' },
];

export const CONDITIONS = [
  { id: 'pcos', label: 'SOP (ovario poliquístico)', icon: 'circle-dashed',
    tip: 'El SOP suele causar ciclos largos o irregulares: Lunara te muestra rangos en lugar de una fecha exacta. Registrar acné, vello o retrasos ayuda a tu médico.' },
  { id: 'endometriosis', label: 'Endometriosis', icon: 'target',
    tip: 'Registra la intensidad de tus cólicos y el dolor pélvico: ver cómo cambian a lo largo de los meses ayuda a ajustar tu tratamiento.' },
  { id: 'fibroids', label: 'Miomas', icon: 'circle-dot',
    tip: 'Los miomas pueden alargar el periodo o hacerlo más abundante. Si necesitas cambiar de producto cada hora, coméntalo con tu médico.' },
  { id: 'thyroid', label: 'Problemas de tiroides', icon: 'activity',
    tip: 'La tiroides influye en la duración del ciclo. Si tus ciclos cambian de golpe, puede valer la pena revisar tu tratamiento.' },
  { id: 'diabetes', label: 'Diabetes', icon: 'droplets',
    tip: 'Las hormonas del ciclo pueden mover tu glucosa, sobre todo antes del periodo. Vigílala con más atención esos días.' },
  { id: 'anemia', label: 'Anemia', icon: 'battery-low',
    tip: 'Con anemia, los periodos abundantes cansan más. Prioriza alimentos ricos en hierro durante tu periodo.' },
];

export const option = (list, id) => list.find((x) => x.id === id);
export const methodOf = (profile) => option(CONTRACEPTION, profile.contraception) || null;
export const methodMode = (profile) => methodOf(profile)?.mode || 'natural';

/** ¿Tiene sentido calcular ventana fértil y ovulación? */
export const fertilityTracked = (profile) => methodMode(profile) === 'natural';

/** Píldora cuyo recordatorio tiene sentido (también para usuarias antiguas sin método indicado). */
export const takesPill = (profile, reminders) =>
  ['pill', 'minipill'].includes(profile.contraception) || (!profile.contraception && !!reminders?.pill?.on);

/** Métodos con recordatorios o fechas que gestionar */
export const methodHasReminder = (id) => ['pill', 'minipill', 'patch', 'ring', 'injection', 'implant', 'iud-hormonal', 'iud-copper'].includes(id);

export function age(profile, today = todayKey()) {
  const y = Number(profile.birthYear);
  if (!Number.isInteger(y) || y < 1900) return null;
  return Number(today.slice(0, 4)) - y;
}

/** Último peso registrado (opcionalmente desde una fecha) o el del perfil. */
export function latestWeight(state, since = null) {
  const entries = Object.entries(state.logs).filter(([d, l]) => l.weight && (!since || d >= since)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (entries.length) return { value: entries[0][1].weight, date: entries[0][0] };
  return state.profile.weight ? { value: state.profile.weight, date: null } : null;
}

export function bmi(state) {
  const h = Number(state.profile.height);
  const w = latestWeight(state);
  if (!h || !w) return null;
  const value = w.value / ((h / 100) ** 2);
  let cat, tone;
  if (value < 18.5) { cat = 'Bajo peso'; tone = 'warn'; }
  else if (value < 25) { cat = 'Peso saludable'; tone = 'ok'; }
  else if (value < 30) { cat = 'Sobrepeso'; tone = 'mid'; }
  else { cat = 'Obesidad'; tone = 'warn'; }
  return { value: Math.round(value * 10) / 10, cat, tone };
}

/** ¿Hay motivos para esperar ciclos irregulares? */
export function irregularReason(state, stats) {
  const p = state.profile;
  if ((p.conditions || []).includes('pcos')) return 'tienes SOP';
  if (p.situation === 'postpill') return 'dejaste hace poco un anticonceptivo hormonal';
  if (p.situation === 'postpartum' || p.situation === 'breastfeeding') return 'estás en posparto o lactancia';
  if (p.situation === 'perimenopause') return 'estás en la perimenopausia';
  if (stats?.regular === false) return 'tus ciclos registrados varían bastante';
  if (stats?.regular === null && p.regularity === 'irregular') return 'nos dijiste que tus ciclos son irregulares';
  const a = age(p);
  if (a !== null && a < 18 && stats?.regular !== true) return 'en la adolescencia los ciclos aún se están regulando';
  return null;
}

// ---------- Calendario del método anticonceptivo ----------

/**
 * Plan del método: blíster/parche/anillo (con fecha de inicio), inyección o dispositivo.
 * Devuelve null si el método no tiene un calendario que calcular.
 */
export function contraceptionPlan(state, today = todayKey()) {
  const p = state.profile;
  const m = methodOf(p);
  if (!m) return null;
  const start = isValidKey(p.methodDate) ? p.methodDate : null;

  if (m.mode === 'pack') {
    const type = m.id === 'pill' ? (p.packType || '21-7') : (p.packType === 'continuous' ? 'continuous' : '21-7');
    if (!start) return { kind: 'pack', method: m, type, needsDate: true };
    const continuous = type === 'continuous';
    const active = type === '24-4' ? 24 : 21;
    const n = Math.max(0, Math.floor(diffDays(start, today) / 28));
    const packs = [-1, 0, 1, 2, 3, 4, 5].map((k) => n + k).filter((k) => k >= 0).map((k) => {
      const s = addDays(start, 28 * k);
      const bleedStart = addDays(s, active + 1);
      return { packStart: s, breakStart: addDays(s, active), bleedStart, bleedEnd: addDays(bleedStart, active === 21 ? 3 : 2), nextPack: addDays(s, 28) };
    });
    const cur = packs.find((x) => x.packStart <= today && today < x.nextPack) || packs[0];
    const day = diffDays(cur.packStart, today) + 1;
    return {
      kind: 'pack', method: m, type, continuous, active, start,
      pause: m.id === 'pill' ? type === '21-7' : !continuous,
      day: Math.max(1, day), inBreak: !continuous && day > active, current: cur,
      packs: packs.filter((x) => x.nextPack > today),
      bleeds: continuous ? [] : packs.filter((x) => x.bleedEnd >= addDays(today, -40)),
    };
  }
  if (m.id === 'minipill') return { kind: 'daily', method: m };
  if (m.id === 'injection') {
    const interval = Number(p.injectionInterval) === 30 ? 30 : 90;
    if (!start) return { kind: 'injection', method: m, interval, needsDate: true };
    const next = addDays(start, interval);
    return { kind: 'injection', method: m, interval, last: start, next, daysLeft: diffDays(today, next) };
  }
  if (m.years) {
    if (!start) return { kind: 'device', method: m, needsDate: true };
    const expiry = addDays(start, Math.round(m.years * 365.25));
    return { kind: 'device', method: m, placed: start, expiry, daysLeft: diffDays(today, expiry) };
  }
  return null;
}

// ---------- Embarazo: ganancia de peso recomendada (guías IOM 2009) ----------
const GAIN = {
  under: { total: [12.5, 18], rate: [0.44, 0.58] },
  normal: { total: [11.5, 16], rate: [0.35, 0.5] },
  over: { total: [7, 11.5], rate: [0.23, 0.33] },
  obese: { total: [5, 9], rate: [0.17, 0.27] },
};

export function pregnancyWeight(state, preg) {
  const pre = Number(state.profile.weight);
  const h = Number(state.profile.height);
  if (!pre || !h || !preg) return null;
  const b = pre / ((h / 100) ** 2);
  const g = GAIN[b < 18.5 ? 'under' : b < 25 ? 'normal' : b < 30 ? 'over' : 'obese'];
  const w = Math.min(40, Math.max(0, preg.week));
  const lo = w <= 13 ? (0.5 * w) / 13 : Math.min(g.total[0], 0.5 + (w - 13) * g.rate[0]);
  const hi = w <= 13 ? (2 * w) / 13 : Math.min(g.total[1], 2 + (w - 13) * g.rate[1]);
  const cur = latestWeight(state, preg.lmp);
  const gain = cur?.date ? Math.round((cur.value - pre) * 10) / 10 : null;
  return {
    preBmi: Math.round(b * 10) / 10, total: g.total,
    expected: [Math.round(lo * 10) / 10, Math.round(hi * 10) / 10],
    gain, status: gain === null ? null : gain < lo - 1 ? 'below' : gain > hi + 1 ? 'above' : 'ok',
  };
}

// ---------- Consejos y alertas según el perfil ----------

/** Avisos personalizados para el análisis (además de los del ciclo). */
export function profileAlerts(state, stats, pred) {
  const p = state.profile;
  const out = [];
  const a = age(p);
  const m = methodOf(p);
  const b = bmi(state);
  if (b && b.value < 18.5) out.push(`Tu IMC (${b.value}) está por debajo de lo saludable: un peso bajo puede retrasar o detener la ovulación.`);
  if (b && b.value >= 30) out.push(`Tu IMC (${b.value}) está en rango de obesidad: puede influir en la regularidad del ciclo y en la ovulación.`);
  if (m?.combined && p.smoker && a !== null && a >= 35) out.push('Fumas, tienes 35 años o más y usas un método con estrógeno: este conjunto aumenta el riesgo de trombosis. Coméntalo con tu médico.');
  if (m?.id === 'iud-copper' && stats.avgPeriod > 7) out.push('El DIU de cobre puede alargar el periodo o hacerlo más abundante; si te causa cansancio, consulta.');
  if ((p.conditions || []).includes('endometriosis')) {
    const since = addDays(todayKey(), -90);
    const pain = Object.entries(state.logs).filter(([d, l]) => d >= since && (l.symptoms || []).some((x) => ['cramps', 'pelvic'].includes(x))).length;
    if (pain >= 15) out.push(`Registraste dolor en ${pain} días de los últimos 90: compártelo con tu médico.`);
  }
  if (a !== null && a >= 40 && fertilityTracked(p)) {
    const since = addDays(todayKey(), -90);
    const flashes = Object.entries(state.logs).filter(([d, l]) => d >= since && (l.symptoms || []).includes('hotflash')).length;
    if (stats.regular === false || flashes >= 3) out.push('Ciclos irregulares o sofocos a partir de los 40 pueden ser señales de perimenopausia.');
  }
  if (p.goal === 'conceive' && isValidKey(p.conceiveSince)) {
    const months = Math.floor(diffDays(p.conceiveSince, todayKey()) / 30.4);
    const limit = a !== null && a >= 35 ? 6 : 12;
    if (months >= limit) out.push(`Llevas unos ${months} meses buscando embarazo. ${a !== null && a >= 35 ? 'A partir de los 35' : 'Tras un año'} se recomienda consultar a un especialista en fertilidad.`);
  }
  if (pred?.late >= 10 && p.sexActive === false) out.push('Tu periodo se ha retrasado sin relaciones: el estrés, el peso o la tiroides pueden influir.');
  return out;
}

/** ¿Hay que suavizar las alertas de irregularidad? (adolescencia, posparto, recién dejado el anticonceptivo) */
export function irregularityExpected(profile) {
  const a = age(profile);
  return (a !== null && a < 18) || ['postpill', 'postpartum', 'breastfeeding', 'perimenopause'].includes(profile.situation);
}

export const SITUATION_NOTES = {
  postpill: 'Tras dejar un anticonceptivo hormonal, el ciclo puede tardar hasta 3 meses en regularse. Mientras tanto te mostramos rangos.',
  postpartum: 'Después del parto el periodo puede tardar meses en volver, y puedes ovular antes de tu primera regla. Las predicciones son orientativas.',
  breastfeeding: 'Con lactancia el periodo puede no volver durante meses, pero puedes ovular antes de tu primera regla. Si no buscas embarazo, usa un método fiable.',
  perimenopause: 'En la perimenopausia los ciclos se vuelven irregulares. Te mostramos rangos en lugar de una fecha exacta.',
};
