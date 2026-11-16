// Estado de la app, guardado solo en este dispositivo (localStorage).
const KEY = 'lunara:v1';

export const defaults = () => ({
  version: 1,
  onboarded: false,
  profile: {
    name: '',
    goal: 'track', // track | conceive | pregnant
    cycleLength: 28,
    periodLength: 5,
    lutealLength: 14,
    // Perfil de salud (opcional): adapta predicciones, avisos y consejos. Ver health.js
    contraception: null, // null = no indicado | id de CONTRACEPTION
    packType: null, // '21-7' | '28' | '24-4' | 'continuous'
    methodDate: null, // inicio del blíster actual / última inyección / colocación del implante o DIU
    injectionInterval: 90, // 30 | 90 días
    sexActive: null, // true | false | null (prefiere no decir)
    birthYear: null,
    height: null, // cm
    weight: null, // kg de referencia (antes del embarazo si está embarazada)
    regularity: null, // 'regular' | 'irregular' | 'unknown'
    situation: 'none', // none | postpill | postpartum | breastfeeding | perimenopause
    conditions: [], // ids de CONDITIONS
    smoker: false,
    conceiveSince: null, // fecha en la que empezó a buscar embarazo
  },
  periodDays: [], // claves 'YYYY-MM-DD' ordenadas
  logs: {}, // clave -> { flow, symptoms[], moods[], discharge, sex, pill, temp, weight, water, sleep, ovTest, pregTest, notes }
  pregnancy: { lmp: null },
  feedback: [], // sugerencias enviadas: { id, category, text, at }
  reminders: {
    enabled: false,
    time: '09:00',
    periodBefore: { on: true, days: 2 },
    periodStart: { on: true },
    periodLate: { on: true },
    fertile: { on: true },
    ovulation: { on: true },
    pill: { on: false, time: '21:00' },
    water: { on: false, times: ['10:00', '13:00', '16:00', '19:00'] },
    logDaily: { on: false, time: '21:30' },
    bbt: { on: false, time: '07:00' },
    pregnancyWeekly: { on: true },
  },
  settings: { theme: 'auto', pinHash: null, discreet: false, guideSeen: false, healthAsked: false },
});

function merge(base, saved) {
  if (saved === undefined || saved === null) return base;
  if (base === null || base === undefined || typeof base !== 'object' || Array.isArray(base)) return saved;
  if (typeof saved !== 'object' || Array.isArray(saved)) return base;
  const out = { ...base };
  for (const k of Object.keys(saved)) out[k] = merge(base[k], saved[k]);
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? merge(defaults(), JSON.parse(raw)) : defaults();
  } catch {
    return defaults();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('No se pudo guardar', e); }
}
function emit() { listeners.forEach((f) => f(state)); }

export const getState = () => state;
export const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };

export function update(mutator) {
  mutator(state);
  persist();
  emit();
}

export function replaceState(next) {
  state = merge(defaults(), next);
  persist();
  emit();
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  state = defaults();
  emit();
}

export const getLog = (key) => state.logs[key] || {};

const isEmpty = (v) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

export function setLog(key, patch) {
  update((s) => {
    const log = { ...(s.logs[key] || {}), ...patch };
    for (const k of Object.keys(log)) if (isEmpty(log[k])) delete log[k];
    if (Object.keys(log).length) s.logs[key] = log; else delete s.logs[key];
  });
}

export function setPeriodDay(key, on) {
  update((s) => {
    const set = new Set(s.periodDays);
    if (on) set.add(key); else set.delete(key);
    s.periodDays = [...set].sort();
  });
}

export function setPeriodDays(keys, on) {
  update((s) => {
    const set = new Set(s.periodDays);
    keys.forEach((k) => (on ? set.add(k) : set.delete(k)));
    s.periodDays = [...set].sort();
  });
}
