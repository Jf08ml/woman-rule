// Las fechas se manejan como claves locales 'YYYY-MM-DD' para evitar problemas de zona horaria.
export const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayKey = () => toKey(new Date());
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
/** b - a en días */
export const diffDays = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
export const isValidKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(fromKey(k).getTime());
export const fmt = (k, opts = { day: 'numeric', month: 'short' }) => fromKey(k).toLocaleDateString('es', opts);
export const fmtLong = (k) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
export const atTime = (k, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromKey(k); d.setHours(h, m, 0, 0); return d;
};
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
