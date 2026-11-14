// Motor de ciclo: agrupa días de periodo, calcula estadísticas y predicciones.
// Las predicciones son estimaciones y no sustituyen el consejo médico ni un método anticonceptivo.
import { addDays, diffDays, todayKey } from './dates.js';

export function getPeriods(periodDays) {
  const periods = [];
  let cur = null;
  for (const d of [...periodDays].sort()) {
    if (cur && diffDays(cur.end, d) <= 2) cur.end = d; // tolera 1 día sin marcar
    else { cur = { start: d, end: d }; periods.push(cur); }
  }
  periods.forEach((p) => { p.length = diffDays(p.start, p.end) + 1; });
  return periods;
}

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

export function computeStats(state) {
  const periods = getPeriods(state.periodDays);
  const cycles = [];
  for (let i = 1; i < periods.length; i++) {
    cycles.push({ start: periods[i - 1].start, length: diffDays(periods[i - 1].start, periods[i].start), periodLength: periods[i - 1].length });
  }
  const valid = cycles.filter((c) => c.length >= 18 && c.length <= 60).slice(-6);
  // Media ponderada: los ciclos recientes pesan más
  let avgCycle = state.profile.cycleLength;
  if (valid.length) {
    let w = 0, sum = 0;
    valid.forEach((c, i) => { const wi = i + 1; w += wi; sum += c.length * wi; });
    avgCycle = Math.round(sum / w);
  }
  const closed = periods.slice(0, -1).concat(periods.length && diffDays(periods.at(-1).end, todayKey()) > 1 ? [periods.at(-1)] : []);
  const recentP = closed.slice(-6).map((p) => p.length).filter((l) => l >= 1 && l <= 12);
  const avgPeriod = recentP.length ? Math.round(mean(recentP)) : state.profile.periodLength;
  const lengths = valid.map((c) => c.length);
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  return {
    periods, cycles, avgCycle, avgPeriod, variation,
    regular: variation === null ? null : variation <= 7,
    minCycle: lengths.length ? Math.min(...lengths) : null,
    maxCycle: lengths.length ? Math.max(...lengths) : null,
  };
}

function windowFor(periodStart, luteal) {
  const ovulation = addDays(periodStart, -luteal);
  return { periodStart, ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1) };
}

export function predict(state, today = todayKey(), stats = computeStats(state)) {
  const last = stats.periods.at(-1);
  if (!last) return null;
  const luteal = Math.min(Math.max(state.profile.lutealLength || 14, 9), 18);
  const { avgCycle, avgPeriod } = stats;
  const cycleDay = diffDays(last.start, today) + 1;
  const expected = addDays(last.start, avgCycle);
  const late = Math.max(0, diffDays(expected, today));
  const sinceStart = diffDays(last.start, today);
  const inPeriod = sinceStart >= 0 && (today <= last.end || (sinceStart < avgPeriod && diffDays(last.end, today) <= 1));
  const current = windowFor(expected, luteal);

  const base = late > 0 ? today : expected;
  const upcoming = [0, 1, 2, 3].map((k) => {
    const start = addDays(base, k * avgCycle);
    return { ...windowFor(start, luteal), periodEnd: addDays(start, avgPeriod - 1) };
  });
  const nextStart = upcoming[0].periodStart;

  let phase;
  if (inPeriod) phase = 'menstrual';
  else if (late > 0) phase = 'late';
  else if (today === current.ovulation) phase = 'ovulation';
  else if (today >= current.fertileStart && today <= current.fertileEnd) phase = 'fertile';
  else if (today < current.fertileStart) phase = 'follicular';
  else phase = 'luteal';

  let chance = 'baja';
  if (phase === 'ovulation' || (phase === 'fertile' && diffDays(today, current.ovulation) <= 2 && today < current.ovulation)) chance = 'alta';
  else if (phase === 'fertile') chance = 'media';

  return {
    last, cycleDay, expected, late, inPeriod, periodDay: inPeriod ? sinceStart + 1 : null,
    current, upcoming, nextStart, daysUntil: diffDays(today, nextStart), phase, chance,
    avgCycle, avgPeriod, luteal,
  };
}

/** Mapa fecha -> tipo para el calendario. Prioridad: period > predicted > ovulation > fertile */
export function buildDayMap(state, stats, pred, today = todayKey()) {
  const map = new Map();
  const rank = { fertile: 1, ovulation: 2, predicted: 3, period: 4 };
  const set = (k, t) => { const prev = map.get(k); if (!prev || rank[t] > rank[prev]) map.set(k, t); };
  const range = (a, b, t) => { for (let d = a; d <= b; d = addDays(d, 1)) set(d, t); };
  const luteal = pred?.luteal ?? 14;

  // Ventanas fértiles estimadas en ciclos pasados
  for (let i = 1; i < stats.periods.length; i++) {
    const w = windowFor(stats.periods[i].start, luteal);
    if (w.fertileStart > stats.periods[i - 1].end) {
      range(w.fertileStart, w.fertileEnd, 'fertile'); set(w.ovulation, 'ovulation');
    }
  }
  if (pred) {
    range(pred.current.fertileStart, pred.current.fertileEnd, 'fertile'); set(pred.current.ovulation, 'ovulation');
    if (pred.inPeriod) {
      const end = addDays(pred.last.start, pred.avgPeriod - 1);
      for (let d = addDays(pred.last.end, 1); d <= end; d = addDays(d, 1)) if (d >= today) set(d, 'predicted');
    }
    pred.upcoming.forEach((w, i) => {
      if (i > 0 || pred.late === 0) { range(w.fertileStart, w.fertileEnd, 'fertile'); set(w.ovulation, 'ovulation'); }
      range(w.periodStart, w.periodEnd, 'predicted');
    });
  }
  state.periodDays.forEach((k) => set(k, 'period'));
  return map;
}

export function pregnancyInfo(state, today = todayKey()) {
  const lmp = state.pregnancy.lmp || getPeriods(state.periodDays).at(-1)?.start;
  if (!lmp) return null;
  const days = diffDays(lmp, today);
  const week = Math.floor(days / 7);
  const due = addDays(lmp, 280);
  return {
    lmp, due, days, week, dayOfWeek: days % 7,
    trimester: week < 13 ? 1 : week < 27 ? 2 : 3,
    daysLeft: diffDays(today, due),
    progress: Math.min(1, Math.max(0, days / 280)),
  };
}
