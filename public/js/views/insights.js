import { getState } from '../store.js';
import { computeStats, predict } from '../cycle.js';
import { todayKey, addDays, diffDays, fmt } from '../dates.js';
import { SYMPTOMS, MOODS } from '../catalog.js';
import { esc, toast } from '../ui.js';
import { icon } from '../icons.js';

function lineChart(points, unit, decimals) {
  if (points.length < 2) return '<p class="muted small">Registra al menos 2 valores para ver la gráfica.</p>';
  const W = 320, H = 140, P = 24;
  const vals = points.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 0.2) { min -= 0.1; max += 0.1; }
  const t0 = points[0].d, span = Math.max(1, diffDays(t0, points.at(-1).d));
  const x = (d) => P + (diffDays(t0, d) / span) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  return `
  <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Gráfica">
    <line class="axis" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/>
    <text class="tick" x="${P}" y="${y(max) - 6}">${max.toFixed(decimals)} ${unit}</text>
    <text class="tick" x="${P}" y="${H - 6}">${fmt(t0)}</text>
    <text class="tick end" x="${W - P}" y="${H - 6}">${fmt(points.at(-1).d)}</text>
    <path class="line" d="${path}"/>
    ${points.map((p) => `<circle class="pt" cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${fmt(p.d)}: ${p.v} ${unit}</title></circle>`).join('')}
  </svg>`;
}

function topCounts(logs, field, catalog, since) {
  const counts = {};
  for (const [d, log] of Object.entries(logs)) {
    if (d < since) continue;
    (log[field] || []).forEach((id) => { if (id !== 'fine') counts[id] = (counts[id] || 0) + 1; });
  }
  const arr = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!arr.length) return '<p class="muted small">Sin registros en los últimos 90 días.</p>';
  const max = arr[0][1];
  return `<ul class="bars">${arr.map(([id, n]) => {
    const o = catalog.find((x) => x.id === id) || { icon: 'circle', label: id };
    return `<li><span class="h-ic">${icon(o.icon)} ${esc(o.label)}</span><i style="--w:${(n / max) * 100}%"></i><b>${n}</b></li>`;
  }).join('')}</ul>`;
}

function buildSummary(s, stats, pred) {
  const lines = ['Resumen de mi ciclo (Lunara)', ''];
  lines.push(`Ciclo promedio: ${stats.avgCycle} días`);
  lines.push(`Periodo promedio: ${stats.avgPeriod} días`);
  if (stats.variation !== null) lines.push(`Variación entre ciclos: ${stats.variation} días`);
  if (pred) lines.push(`Último periodo: ${fmt(pred.last.start, { day: 'numeric', month: 'long', year: 'numeric' })}`);
  lines.push('', 'Últimos ciclos:');
  stats.cycles.slice(-6).forEach((c) => lines.push(`- ${fmt(c.start, { day: 'numeric', month: 'short', year: 'numeric' })}: ${c.length} días (periodo ${c.periodLength})`));
  return lines.join('\n');
}

export function render() {
  const s = getState();
  const t = todayKey();
  const stats = computeStats(s);
  const pred = predict(s, t, stats);
  const since = addDays(t, -90);

  const cycles = stats.cycles.slice(-12);
  const maxLen = Math.max(35, ...cycles.map((c) => c.length), pred ? pred.cycleDay : 0);
  let history = cycles.map((c) => `
    <li><span class="h-date">${fmt(c.start)}</span>
      <span class="h-bar" style="--total:${(c.length / maxLen) * 100}%;--pw:${(c.periodLength / c.length) * 100}%"></span>
      <b>${c.length} d</b></li>`).reverse().join('');
  if (pred) {
    history = `<li class="current"><span class="h-date">${fmt(pred.last.start)}</span>
      <span class="h-bar" style="--total:${(Math.min(pred.cycleDay, maxLen) / maxLen) * 100}%;--pw:${(pred.last.length / Math.max(pred.cycleDay, 1)) * 100}%"></span>
      <b>${pred.cycleDay} d…</b></li>` + history;
  }

  const temps = Object.entries(s.logs).filter(([d, l]) => l.temp && d >= addDays(t, -60)).map(([d, l]) => ({ d, v: l.temp })).sort((a, b) => (a.d < b.d ? -1 : 1));
  const weights = Object.entries(s.logs).filter(([d, l]) => l.weight && d >= addDays(t, -180)).map(([d, l]) => ({ d, v: l.weight })).sort((a, b) => (a.d < b.d ? -1 : 1));

  const alerts = [];
  if (stats.cycles.length >= 2) {
    if (stats.avgCycle < 21) alerts.push('Tus ciclos son más cortos de 21 días de media.');
    if (stats.avgCycle > 35) alerts.push('Tus ciclos duran más de 35 días de media.');
    if (stats.variation > 9) alerts.push(`Tus ciclos varían ${stats.variation} días entre sí.`);
  }
  if (stats.avgPeriod > 7) alerts.push('Tu periodo suele durar más de 7 días.');
  if (pred?.late >= 10) alerts.push(`Tu periodo lleva ${pred.late} días de retraso.`);

  const regularity = stats.regular === null ? '—' : stats.regular ? 'Regular' : 'Irregular';

  return {
    html: `
    <header class="topbar"><div><p class="eyebrow">Tus datos</p><h1>Análisis</h1></div></header>
    <div class="stats">
      <div class="stat"><small>Ciclo promedio</small><strong>${stats.avgCycle}<span> días</span></strong></div>
      <div class="stat"><small>Periodo promedio</small><strong>${stats.avgPeriod}<span> días</span></strong></div>
      <div class="stat"><small>Regularidad</small><strong class="${stats.regular === false ? 'warn' : ''}">${regularity}</strong>${stats.variation !== null ? `<span class="muted small">±${stats.variation} días</span>` : ''}</div>
      <div class="stat"><small>Ciclos registrados</small><strong>${stats.cycles.length}</strong></div>
    </div>
    ${stats.cycles.length < 2 ? '<p class="muted center small">Registra al menos 2 periodos para obtener estadísticas personalizadas. Mientras tanto usamos los valores de tu perfil.</p>' : ''}

    ${alerts.length ? `<section class="card warn-card"><h2 class="h-ic warn-ic">${icon('triangle-alert')} Para comentar con tu médico</h2><ul class="tips">${alerts.map((a) => `<li>${a}</li>`).join('')}</ul>
      <p class="muted small">Esto no es un diagnóstico. Un profesional de salud puede ayudarte a valorarlo.</p></section>` : ''}

    <section class="card">
      <h2>Historial de ciclos</h2>
      ${history ? `<ul class="history">${history}</ul><div class="legend"><span><i class="lg lg-period"></i>Periodo</span><span><i class="lg lg-cycle"></i>Ciclo</span></div>` : '<p class="muted small">Aún no hay ciclos registrados.</p>'}
    </section>

    <section class="card"><h2>Síntomas frecuentes</h2><p class="muted small">Últimos 90 días</p>${topCounts(s.logs, 'symptoms', SYMPTOMS, since)}</section>
    <section class="card"><h2>Estado de ánimo</h2><p class="muted small">Últimos 90 días</p>${topCounts(s.logs, 'moods', MOODS, since)}</section>
    <section class="card"><h2 class="h-ic">${icon('thermometer')} Temperatura basal</h2><p class="muted small">Últimos 60 días · un aumento sostenido de ~0,2 °C suele indicar que ya ovulaste.</p>${lineChart(temps, '°C', 2)}</section>
    <section class="card"><h2 class="h-ic">${icon('weight')} Peso</h2>${lineChart(weights, 'kg', 1)}</section>

    <div class="center-actions"><button class="btn secondary" data-act="share">${icon('share-2')} Compartir resumen para mi médico</button></div>
    `,
    bind(root) {
      root.querySelector('[data-act=share]').addEventListener('click', async () => {
        const text = buildSummary(s, stats, pred);
        try {
          if (navigator.share) await navigator.share({ title: 'Resumen de mi ciclo', text });
          else { await navigator.clipboard.writeText(text); toast('Resumen copiado al portapapeles'); }
        } catch { /* cancelado */ }
      });
    },
  };
}
