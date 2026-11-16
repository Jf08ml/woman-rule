// Buzón de mejoras: las usuarias envían sugerencias y el equipo las gestiona desde /admin.html.
// No se guardan datos de salud ni la IP (solo un hash temporal para limitar envíos).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './push-core.js';

export const CATEGORIES = ['feature', 'improve', 'bug', 'other'];
export const STATUSES = ['new', 'review', 'planned', 'done', 'declined'];
const GOALS = ['track', 'conceive', 'pregnant'];
const MAX_PER_HOUR = 5;
const ID_RE = /^[A-Za-z0-9_-]{8,20}$/;

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const hashIp = (ip) => crypto.createHash('sha256').update(`lunara-fb:${ip || 'unknown'}`).digest('hex').slice(0, 20);

/** Almacén en archivo JSON (servidor local). */
export function feedbackFileStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'feedback.json');
  let db = {};
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* primera ejecución */ }
  const hits = new Map();
  const save = () => { fs.writeFileSync(file + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(file + '.tmp', file); };
  return {
    async all() { return Object.values(db); },
    async getMany(ids) { return ids.map((id) => db[id] || null); },
    async get(id) { return db[id] || null; },
    async put(item) { db[item.id] = item; save(); },
    async del(id) { delete db[id]; save(); },
    async hit(key) {
      const now = Date.now();
      const list = (hits.get(key) || []).filter((t) => now - t < 3600_000);
      list.push(now); hits.set(key, list);
      return list.length;
    },
  };
}

/** Almacén en Upstash Redis (Vercel). */
export function feedbackRedisStore(redis) {
  const H = 'lunara:feedback';
  return {
    async all() { return Object.values((await redis.hgetall(H)) || {}); },
    async getMany(ids) { return ids.length ? (await redis.hmget(H, ...ids)).map((x) => x || null) : []; },
    async get(id) { return (await redis.hget(H, id)) || null; },
    async put(item) { await redis.hset(H, { [item.id]: item }); },
    async del(id) { await redis.hdel(H, id); },
    async hit(key) {
      const k = `lunara:fb-rate:${key}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, 3600);
      return n;
    },
  };
}

export function createFeedbackService({ store, adminKey }) {
  function requireAdmin(authorization) {
    const expected = Buffer.from(`Bearer ${adminKey || ''}`);
    const got = Buffer.from(String(authorization || ''));
    if (!adminKey || got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) throw new HttpError(401, 'No autorizado');
  }

  /** Nueva sugerencia de una usuaria. */
  async function submit(body, ip) {
    if (body?.website) return { ok: true, id: crypto.randomBytes(9).toString('base64url') }; // trampa para bots
    const text = str(body?.text, 2000);
    if (text.length < 10) throw new HttpError(400, 'Cuéntanos un poco más (mínimo 10 caracteres)');
    if (text.length > 1500) throw new HttpError(400, 'El texto es demasiado largo (máximo 1500 caracteres)');
    if ((await store.hit(hashIp(ip))) > MAX_PER_HOUR) throw new HttpError(429, 'Has enviado muchas sugerencias seguidas. Inténtalo más tarde.');
    const now = Date.now();
    const item = {
      id: crypto.randomBytes(9).toString('base64url'),
      category: CATEGORIES.includes(body?.category) ? body.category : 'other',
      text,
      contact: str(body?.contact, 120),
      version: str(body?.version, 20),
      goal: GOALS.includes(body?.goal) ? body.goal : '',
      platform: str(body?.platform, 40),
      status: 'new', reply: '', createdAt: now, updatedAt: now,
    };
    await store.put(item);
    return { ok: true, id: item.id };
  }

  /** Estado y respuesta de las sugerencias propias (la usuaria solo conoce sus ids). */
  async function statuses(ids) {
    const clean = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => ID_RE.test(id)))].slice(0, 50);
    const items = await store.getMany(clean);
    const out = {};
    clean.forEach((id, i) => { const it = items[i]; if (it) out[id] = { status: it.status, reply: it.reply, updatedAt: it.updatedAt }; });
    return { items: out };
  }

  async function list(authorization) {
    requireAdmin(authorization);
    const items = (await store.all()).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    return { items };
  }

  async function admin(authorization, body) {
    requireAdmin(authorization);
    const id = String(body?.id || '');
    if (!ID_RE.test(id)) throw new HttpError(400, 'Id inválido');
    if (body.action === 'delete') { await store.del(id); return { ok: true }; }
    const item = await store.get(id);
    if (!item) throw new HttpError(404, 'No existe');
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) throw new HttpError(400, 'Estado inválido');
      item.status = body.status;
    }
    if (body.reply !== undefined) item.reply = str(body.reply, 1000);
    item.updatedAt = Date.now();
    await store.put(item);
    return { ok: true, item };
  }

  return { submit, statuses, list, admin };
}
